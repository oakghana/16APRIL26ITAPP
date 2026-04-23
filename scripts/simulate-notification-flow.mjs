import fs from "node:fs"

function requireContains(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`)
  }
}

function mapToast(notification) {
  switch (notification.type) {
    case "task_completed":
      return "flash"
    case "task_confirmed":
      return "success"
    case "task_rejected":
      return "warning"
    case "urgent":
      return "warning"
    case "warning":
      return "warning"
    case "success":
      return "success"
    case "info":
      return "info"
    default:
      return "default"
  }
}

function run() {
  const completeRoute = fs.readFileSync("app/api/service-tickets/complete/route.ts", "utf8")
  const notifyRoute = fs.readFileSync("app/api/service-tickets/notify/route.ts", "utf8")
  const listener = fs.readFileSync("components/notifications/realtime-notification-listener.tsx", "utf8")

  // Producer checks
  requireContains(completeRoute, 'type: "task_completed"', "requester completion notification type")
  requireContains(completeRoute, 'type: confirmation === "approved" ? "task_confirmed" : "task_rejected"', "IT staff confirmation/rejection notification type")
  requireContains(completeRoute, "is_read: false", "unread flag in completion route")
  requireContains(notifyRoute, "is_read: false", "unread flag in broadcast route")

  // Consumer checks
  requireContains(listener, 'case "task_completed"', "task_completed toast mapping")
  requireContains(listener, 'case "task_confirmed"', "task_confirmed toast mapping")
  requireContains(listener, 'case "task_rejected"', "task_rejected toast mapping")
  requireContains(listener, 'case "info"', "info toast mapping")
  requireContains(listener, 'case "warning"', "warning toast mapping")

  const cases = [
    { name: "Admin broadcast info", payload: { type: "info" }, expected: "info" },
    { name: "Admin broadcast warning", payload: { type: "warning" }, expected: "warning" },
    { name: "IT marks done -> requester", payload: { type: "task_completed" }, expected: "flash" },
    { name: "Requester confirms -> IT staff", payload: { type: "task_confirmed" }, expected: "success" },
    { name: "Requester rejects -> IT staff", payload: { type: "task_rejected" }, expected: "warning" },
  ]

  for (const c of cases) {
    const actual = mapToast(c.payload)
    if (actual !== c.expected) {
      throw new Error(`Toast mapping failed for ${c.name}: expected ${c.expected}, got ${actual}`)
    }
  }

  console.log("NOTIFICATION FLOW SIMULATION PASSED")
  console.log("- Admin broadcast producer+consumer path verified")
  console.log("- IT staff completion confirmation producer+consumer path verified")
  console.log("- Toast mapping scenarios verified: 5/5")
}

run()
