export interface DeviceTypeOption {
  code: string
  name: string
}

export const DEFAULT_DEVICE_TYPE_CODE = "laptop"

export const DEFAULT_DEVICE_TYPE_OPTIONS: DeviceTypeOption[] = [
  { code: "laptop", name: "Laptop" },
  { code: "desktop", name: "Desktop" },
  { code: "monitor", name: "Monitor" },
  { code: "printer", name: "Printer" },
  { code: "photocopier", name: "Photocopier" },
  { code: "scanner", name: "Scanner" },
  { code: "mobile", name: "Mobile Device" },
  { code: "handset", name: "Handset" },
  { code: "server", name: "Server" },
  { code: "ups", name: "UPS" },
  { code: "stabiliser", name: "Stabiliser" },
  { code: "switch", name: "Network Switch" },
  { code: "router", name: "Router" },
  { code: "network_cable", name: "Network Cable" },
  { code: "network_adapter", name: "Network Adapter" },
  { code: "trunk", name: "Trunk Cable" },
  { code: "projector", name: "Projector" },
  { code: "cctv_camera", name: "CCTV Camera" },
  { code: "external_drive", name: "External Hard Drive" },
  { code: "flash_drive", name: "Flash Drive" },
  { code: "docking_station", name: "Docking Station" },
  { code: "keyboard", name: "Keyboard" },
  { code: "mouse", name: "Mouse" },
  { code: "webcam", name: "Webcam" },
  { code: "headset", name: "Headset" },
  { code: "adapter", name: "Adapter" },
  { code: "charger", name: "Charger" },
  { code: "battery", name: "Battery" },
  { code: "power_cable", name: "Power Cable" },
  { code: "hdmi_cable", name: "HDMI Cable" },
  { code: "vga_cable", name: "VGA Cable" },
  { code: "toner", name: "Toner Cartridge" },
  { code: "ink", name: "Ink Cartridge" },
  { code: "cable", name: "Cable" },
  { code: "other", name: "Other IT Equipment" },
]

const DEVICE_TYPE_ALIASES: Record<string, string> = {
  mobile_device: "mobile",
  mobile_devices: "mobile",
  phones: "handset",
  phone: "handset",
  head_set: "headset",
  cctv: "cctv_camera",
  cctvcamera: "cctv_camera",
  external_hdd: "external_drive",
  external_ssd: "external_drive",
  external_hard_drive: "external_drive",
  usb_flash_drive: "flash_drive",
  pen_drive: "flash_drive",
  thumb_drive: "flash_drive",
  network_switch: "switch",
  wifi_router: "router",
}

function titleCaseFromCode(code: string): string {
  return code
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function normalizeDeviceTypeCode(value: string | null | undefined): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\/\s-]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")

  if (!raw) return "other"
  return DEVICE_TYPE_ALIASES[raw] || raw
}

export function buildDeviceTypeOptions(
  lookupTypes: Array<{ code: string; name: string }> | null | undefined,
  currentValue?: string | null
): DeviceTypeOption[] {
  const merged = new Map<string, DeviceTypeOption>()

  for (const option of DEFAULT_DEVICE_TYPE_OPTIONS) {
    merged.set(option.code, option)
  }

  for (const option of lookupTypes || []) {
    const code = normalizeDeviceTypeCode(option.code)
    merged.set(code, {
      code,
      name: option.name?.trim() || titleCaseFromCode(code),
    })
  }

  const normalizedCurrent = normalizeDeviceTypeCode(currentValue)
  if (normalizedCurrent && !merged.has(normalizedCurrent)) {
    merged.set(normalizedCurrent, {
      code: normalizedCurrent,
      name: titleCaseFromCode(normalizedCurrent),
    })
  }

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name))
}

export function isPrinterLikeDeviceType(value: string | null | undefined): boolean {
  const normalized = normalizeDeviceTypeCode(value)
  return normalized === "printer" || normalized === "photocopier"
}

export function getDefaultDeviceTypeOptions(): DeviceTypeOption[] {
  return buildDeviceTypeOptions([])
}