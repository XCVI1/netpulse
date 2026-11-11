import asyncio
from contextlib import asynccontextmanager
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import ADMIN_PASSWORD, ADMIN_USERNAME, create_token, verify_token
from .database import Base, engine, get_db
from .models import Device, MetricHistory
from .poller import poll_all_devices, process_single_device

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
  # Создаем таблицы при старте
  async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)
  # Запускаем фоновый опрос каждые 30 секунд
  scheduler.add_job(poll_all_devices, "interval", seconds=30)
  scheduler.start()
  yield
  scheduler.shutdown()


app = FastAPI(title="NetPulse Monitoring API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Схемы данных (Pydantic) ---
class LoginRequest(BaseModel):
  username: str
  password: str


class DeviceCreate(BaseModel):
  name: str
  ip_address: str
  device_type: str = "ssh"  # 'ssh' или 'snmp'
  ssh_port: int = 22
  ssh_user: Optional[str] = "root"
  ssh_password: Optional[str] = ""
  snmp_community: Optional[str] = "public"
  snmp_port: int = 161


# --- ПУБЛИЧНЫЕ РОУТЫ (ДЛЯ ДАШБОРДА /) ---
@app.get("/api/devices")
async def get_devices(db: AsyncSession = Depends(get_db)):
  result = await db.execute(select(Device).order_by(Device.id))
  devices = result.scalars().all()
  # Не отдаем пароли на публичный фронтенд!
  return [
      {
          "id": d.id,
          "name": d.name,
          "ip_address": d.ip_address,
          "device_type": d.device_type,
          "status": d.status,
          "last_ping_ms": d.last_ping_ms,
          "cpu_usage": round(d.cpu_usage, 1),
          "ram_usage": round(d.ram_usage, 1),
          "disk_usage": round(d.disk_usage, 1),
          "uptime_str": d.uptime_str,
          "updated_at": d.updated_at,
      }
      for d in devices
  ]


@app.get("/api/devices/{device_id}/history")
async def get_device_history(
    device_id: int, db: AsyncSession = Depends(get_db)
):
  result = await db.execute(
      select(MetricHistory)
      .where(MetricHistory.device_id == device_id)
      .order_by(MetricHistory.recorded_at.desc())
      .limit(20)
  )
  records = result.scalars().all()
  return [
      {
          "time": r.recorded_at.strftime("%H:%M:%S"),
          "cpu": round(r.cpu_usage, 1),
          "ram": round(r.ram_usage, 1),
          "ping": round(r.ping_ms, 1),
      }
      for r in reversed(records)
  ]


# --- ЗАЩИЩЕННЫЕ РОУТЫ (ДЛЯ АДМИНКИ /admin) ---
@app.post("/api/auth/login")
async def login(req: LoginRequest):
  if req.username == ADMIN_USERNAME and req.password == ADMIN_PASSWORD:
    return {"access_token": create_token(req.username)}
  raise HTTPException(status_code=401, detail="Неверный логин или пароль")


@app.post("/api/admin/devices")
async def add_device(
    dev: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(verify_token),
):
  new_dev = Device(**dev.model_dump())
  db.add(new_dev)
  await db.commit()
  await db.refresh(new_dev)
  # Сразу запускаем первый опрос в фоне, чтобы карточка ожила мгновенно
  asyncio.create_task(process_single_device(new_dev.id))
  return {"message": "Device added", "id": new_dev.id}


@app.delete("/api/admin/devices/{device_id}")
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(verify_token),
):
  dev = await db.get(Device, device_id)
  if not dev:
    raise HTTPException(status_code=404, detail="Not found")
  await db.delete(dev)
  await db.commit()
  return {"message": "Deleted"}
