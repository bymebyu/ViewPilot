import { defineConfig } from "wxt";

export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => {
    const base = {
      name: "__MSG_extName__",
      description: "__MSG_extDescription__",
      default_locale: "en",
      permissions: [
        "tabs",
        "storage",
        "activeTab",
        "scripting",
        "contextMenus",
        "cookies",
      ],
      host_permissions: [
        "https://github.com/*",
        "https://api.github.com/*",
        "https://api.githubcopilot.com/*",
        "<all_urls>",
      ],
      content_scripts: [
        {
          matches: ["https://github.com/login/device*"],
          js: ["content-device.js"],
          run_at: "document_idle",
        },
      ],
      icons: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
      action: {
        default_popup: "popup/index.html",
        default_icon: {
          "16": "icons/icon16.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png",
        },
      },
    };

    if (browser === "firefox") {
      return {
        ...base,
        sidebar_action: {
          default_panel: "sidepanel/index.html",
          default_title: "ViewPilot",
        },
        browser_specific_settings: {
          gecko: {
            id: "viewpilot@bymebyu.com",
            strict_min_version: "140.0",
            data_collection_permissions: {
              required: ["none"],
            },
          },
        },
      };
    }

    return {
      ...base,
      permissions: [...base.permissions, "sidePanel"],
      side_panel: {
        default_path: "sidepanel/index.html",
      },
    };
  },
});
