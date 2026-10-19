type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const host = location.hostname.toLowerCase();
const isAdminHost = host === "admin-invest-broker.vercel.app" || host.startsWith("admin-invest-broker-") || host === "invest-broker-19np.vercel.app" || host.startsWith("invest-broker-19np-");
const role = isAdminHost || import.meta.env.VITE_APP_ROLE === "admin" ? "admin" : "user";
const appConfig = role === "admin"
  ? { title: "Invest Broker Admin", manifest: "/manifest-admin.webmanifest", theme: "#1d4ed8" }
  : { title: "Invest Broker", manifest: "/manifest-user.webmanifest", theme: "#0f766e" };

document.title = appConfig.title;
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
if (description) description.content = role === "admin"
  ? "Private Invest Broker administration preview"
  : "Invest Broker customer portal preview";

const manifest = document.createElement("link");
manifest.rel = "manifest";
manifest.href = `${import.meta.env.BASE_URL}${role === "admin" ? "manifest-admin.webmanifest" : "manifest-user.webmanifest"}`;
document.head.appendChild(manifest);

let installPrompt: InstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (event: Event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  if (document.querySelector("#install-app")) return;

  const button = document.createElement("button");
  button.id = "install-app";
  button.type = "button";
  button.textContent = "Install app";
  button.setAttribute("aria-label", `Install ${appConfig.title} on this device`);
  Object.assign(button.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "1000",
    border: "0",
    borderRadius: "999px",
    padding: "13px 18px",
    background: appConfig.theme,
    color: "#fff",
    fontWeight: "700",
    boxShadow: "0 8px 24px #0002",
  });
  button.addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") button.remove();
    installPrompt = null;
  });
  document.body.appendChild(button);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: "none" })
      .catch((error) => console.error("PWA service worker registration failed", error));
  });
}
