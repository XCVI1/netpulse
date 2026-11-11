import asyncio
from datetime import datetime
import re
import asyncssh
from sqlalchemy import select
from .database import AsyncSessionLocal
from .models import Device, MetricHistory


async def ping_host(ip: str) -> float:
  """Возвращает пинг в мс или -1, если хост недоступен"""
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


async def poll_ssh_device(device: Device) -> dict:
  """Подключается по SSH к Linux-серверу и забирает CPU, RAM, Disk и Uptime"""
  try:
    async with asyncssh.connect(
        device.ip_address,
        port=device.ssh_port,
        username=device.ssh_user,
        password=device.ssh_password,
        known_hosts=None,
        connect_timeout=4.0,
    ) as conn:
      # Команда собирает: 1) CPU load (из top), 2) % RAM, 3) % Disk /, 4) Uptime
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
    return {"status": "error", "uptime": f"SSH Err: {str(e)[:25]}"}
  return {"status": "offline", "uptime": "Down"}


async def poll_snmp_device(device: Device) -> dict:
  """Заготовка под опрос Cisco / D-Link по SNMP (пока проверяет ICMP + эмулирует нагрузку ЦПУ)"""
  # В следующем шаге подключим сюда pysnmp для съема трафика с интерфейсов (ifInOctets/ifOutOctets)
  return {
      "status": "online",
      "cpu": 12.5,
      "ram": 40.0,
      "disk": 0.0,
      "uptime": "SNMP Active (Cisco/Switch)",
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
      if device.device_type == "ssh":
        data = await poll_ssh_device(device)
      else:
        data = await poll_snmp_device(device)

      device.status = data.get("status", "online")
      device.cpu_usage = data.get("cpu", 0.0)
      device.ram_usage = data.get("ram", 0.0)
      device.disk_usage = data.get("disk", 0.0)
      device.uptime_str = data.get("uptime", "N/A")

    device.updated_at = datetime.utcnow()

    # Сохраняем точку в историю для графиков
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
    # Опрашиваем все серверы и роутеры параллельно!
    await asyncio.gather(*(process_single_device(d_id) for d_id in device_ids))
