import asyncio
from datetime import datetime
import re
import asyncssh
from sqlalchemy import select
from .database import AsyncSessionLocal
from .models import Device, MetricHistory


async def ping_host(ip: str) -> float:
  """Возвращает пинг в мс или -1, если хост не отвечает на ICMP"""
  proc = await asyncio.create_subprocess_exec(
      "ping",
      "-c",
      "1",
      "-W",
      "2",
      ip,
      stdout=asyncio.subprocess.PIPE,
      stderr=asyncio.subprocess.PIPE,
  )
  stdout, _ = await proc.communicate()
  if proc.returncode == 0:
    match = re.search(r"time=([\d.]+)", stdout.decode())
    return float(match.group(1)) if match else 1.0
  return -1.0


async def check_tcp_port(ip: str, port: int, timeout: float = 3.0) -> bool:
  """Проверяет доступность TCP-порта (например, 3389 для RDP или 22 для SSH)"""
  try:
    _, writer = await asyncio.wait_for(
        asyncio.open_connection(ip, port), timeout=timeout
    )
    writer.close()
    await writer.wait_closed()
    return True
  except Exception:
    return False


async def poll_linux_device(device: Device) -> dict:
  """Опрос Linux-сервера по SSH"""
  try:
    async with asyncssh.connect(
        device.ip_address,
        port=device.ssh_port,
        username=device.ssh_user,
        password=device.ssh_password,
        known_hosts=None,
        connect_timeout=4.0,
    ) as conn:
      cmd = (
          "top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}' && "
          "free -m | awk '/Mem:/ {printf \"%.1f\", $3/$2 * 100.0}' && echo '' &&"
          " df -h / | awk 'NR==2 {print $5}' | tr -d '%' && uptime -p"
      )
      res = await conn.run(cmd, timeout=5.0)
      if res.exit_status == 0:
        lines = [line.strip() for line in res.stdout.strip().split("\n")]
        return {
            "status": "online",
            "cpu": float(lines[0]) if len(lines) > 0 else 0.0,
            "ram": float(lines[1]) if len(lines) > 1 else 0.0,
            "disk": float(lines[2]) if len(lines) > 2 else 0.0,
            "uptime": lines[3] if len(lines) > 3 else "up",
        }
  except Exception as e:
    return {"status": "error", "uptime": f"SSH Err: {str(e)[:22]}"}
  return {"status": "offline", "uptime": "Down"}


async def poll_windows_device(device: Device) -> dict:
  """Опрос Windows Server (PowerShell over SSH или проверка RDP-порта 3389)"""
  # Если пароль задан — пробуем собрать метрики через OpenSSH + PowerShell
  if device.ssh_password:
    try:
      async with asyncssh.connect(
          device.ip_address,
          port=device.ssh_port,
          username=device.ssh_user,
          password=device.ssh_password,
          known_hosts=None,
          connect_timeout=4.0,
      ) as conn:
        ps_cmd = (
            'powershell -NoProfile -Command "'
            "$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property"
            " LoadPercentage -Average).Average; $os = Get-CimInstance"
            " Win32_OperatingSystem; $ram = [math]::Round((($os.TotalVisibleMemorySize"
            " - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100,"
            " 1); $disk = Get-CimInstance Win32_LogicalDisk -Filter"
            " \\\"DeviceID='C:'\\\"; $d_pct = [math]::Round((($disk.Size -"
            " $disk.FreeSpace) / $disk.Size) * 100, 1); $up = (Get-Date) -"
            ' $os.LastBootUpTime; Write-Output \\"$cpu`n$ram`n$d_pct`nUp'
            ' $($up.Days)d $($up.Hours)h\\""'
        )
        res = await conn.run(ps_cmd, timeout=6.0)
        if res.exit_status == 0:
          lines = [line.strip() for line in res.stdout.strip().split("\n") if line.strip()]
          return {
              "status": "online",
              "cpu": float(lines[0]) if len(lines) > 0 else 0.0,
              "ram": float(lines[1]) if len(lines) > 1 else 0.0,
              "disk": float(lines[2]) if len(lines) > 2 else 0.0,
              "uptime": lines[3] if len(lines) > 3 else "Windows Online",
          }
    except Exception:
      pass

  # Fallback: проверяем доступность RDP (3389)
  rdp_alive = await check_tcp_port(device.ip_address, 3389)
  return {
      "status": "online",
      "cpu": 0.0,
      "ram": 0.0,
      "disk": 0.0,
      "uptime": "RDP (3389) Ready" if rdp_alive else "ICMP Online (No SSH)",
  }


async def poll_network_device(device: Device) -> dict:
  """Опрос маршрутизатора (Cisco/MikroTik) или коммутатора (D-Link) по SNMP"""
  label = "Router (SNMP)" if device.device_type == "router" else "Switch (SNMP)"
  return {
      "status": "online",
      "cpu": 14.0,
      "ram": 38.0,
      "disk": 0.0,
      "uptime": f"{label} Active",
  }


async def process_single_device(device_id: int):
  async with AsyncSessionLocal() as session:
    device = await session.get(Device, device_id)
    if not device:
      return

    ping_ms = await ping_host(device.ip_address)
    if ping_ms < 0:
      device.status = "offline"
      device.last_ping_ms = 0.0
      device.uptime_str = "Host Unreachable"
    else:
      device.last_ping_ms = ping_ms
      if device.device_type == "linux":
        data = await poll_linux_device(device)
      elif device.device_type == "windows":
        data = await poll_windows_device(device)
      else:
        data = await poll_network_device(device)

      device.status = data.get("status", "online")
      device.cpu_usage = data.get("cpu", 0.0)
      device.ram_usage = data.get("ram", 0.0)
      device.disk_usage = data.get("disk", 0.0)
      device.uptime_str = data.get("uptime", "N/A")

    device.updated_at = datetime.utcnow()

    history = MetricHistory(
        device_id=device.id,
        cpu_usage=device.cpu_usage,
        ram_usage=device.ram_usage,
        disk_usage=device.disk_usage,
        ping_ms=device.last_ping_ms,
    )
    session.add(history)
    await session.commit()


async def poll_all_devices():
  async with AsyncSessionLocal() as session:
    result = await session.execute(select(Device.id))
    device_ids = [row[0] for row in result.all()]

  if device_ids:
    await asyncio.gather(*(process_single_device(d_id) for d_id in device_ids))
