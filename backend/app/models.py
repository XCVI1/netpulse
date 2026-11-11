from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from .database import Base


class Device(Base):
  __tablename__ = "devices"

  id = Column(Integer, primary_key=True, index=True)
  name = Column(String, nullable=False)
  ip_address = Column(String, nullable=False)
  device_type = Column(String, default="ssh")  # 'ssh' (Linux) или 'snmp' (Cisco/D-Link)

  # Поля для SSH
  ssh_port = Column(Integer, default=22)
  ssh_user = Column(String, nullable=True)
  ssh_password = Column(String, nullable=True)

  # Поля для SNMP
  snmp_community = Column(String, default="public")
  snmp_port = Column(Integer, default=161)

  # Текущее состояние (обновляется воркером для быстрого вывода на дашборд)
  status = Column(String, default="pending")  # online, offline, error
  last_ping_ms = Column(Float, default=0.0)
  cpu_usage = Column(Float, default=0.0)
  ram_usage = Column(Float, default=0.0)
  disk_usage = Column(Float, default=0.0)
  uptime_str = Column(String, default="N/A")
  updated_at = Column(DateTime, default=datetime.utcnow)


class MetricHistory(Base):
  __tablename__ = "metrics_history"

  id = Column(Integer, primary_key=True, index=True)
  device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
  cpu_usage = Column(Float)
  ram_usage = Column(Float)
  disk_usage = Column(Float)
  ping_ms = Column(Float)
  recorded_at = Column(DateTime, default=datetime.utcnow)
