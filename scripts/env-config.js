#!/usr/bin/env node

/**
 * 環境設定ヘルパースクリプト
 * 環境パターンに応じた設定を管理
 */

const environments = {
  local: {
    name: "Local Development",
    description: "Mock BFF + Mock Auth",
    vars: {
      VITE_BFF_BASE_URL: "http://localhost:8787/api/auth",
      VITE_USE_HASH_ROUTING: "false",
      VITE_APP_NAME: "",
      VITE_APP_TITLE: "HierarchiDB (Local)",
      PORT: "4200",
      MOCK_BFF_PORT: "8787"
    }
  },
  staging: {
    name: "Staging (Debug Production)",
    description: "Vite Dev + Production BFF + Real OAuth",
    vars: {
      VITE_BFF_BASE_URL: "https://hierarchidb-bff.kubohiroya.workers.dev/api/auth",
      VITE_USE_HASH_ROUTING: "true",
      VITE_APP_NAME: "hierarchidb",
      VITE_APP_TITLE: "HierarchiDB (Staging)",
      PORT: "4200"
    }
  },
  production: {
    name: "Production",
    description: "GitHub Pages + Production BFF + Real OAuth",
    vars: {
      VITE_BFF_BASE_URL: "https://hierarchidb-bff-prod.kubohiroya.workers.dev/api/auth",
      VITE_USE_HASH_ROUTING: "true",
      VITE_APP_NAME: "hierarchidb",
      VITE_APP_TITLE: "HierarchiDB"
    }
  }
};

// コマンドライン引数を処理
const command = process.argv[2];
const envName = process.argv[3];

function printUsage() {
  console.log("Usage: node env-config.js <command> [environment]");
  console.log("");
  console.log("Commands:");
  console.log("  list     - List all environments");
  console.log("  show     - Show configuration for an environment");
  console.log("  export   - Export environment variables for shell");
  console.log("");
  console.log("Environments:");
  Object.keys(environments).forEach(key => {
    console.log(`  ${key.padEnd(12)} - ${environments[key].description}`);
  });
}

function listEnvironments() {
  console.log("Available Environment Configurations:");
  console.log("=====================================");
  Object.entries(environments).forEach(([key, env]) => {
    console.log(`\n${key.toUpperCase()}: ${env.name}`);
    console.log(`  ${env.description}`);
    console.log("  Variables:");
    Object.entries(env.vars).forEach(([varKey, varValue]) => {
      console.log(`    ${varKey}: ${varValue}`);
    });
  });
}

function showEnvironment(name) {
  const env = environments[name];
  if (!env) {
    console.error(`Environment '${name}' not found`);
    process.exit(1);
  }
  
  console.log(`Environment: ${env.name}`);
  console.log(`Description: ${env.description}`);
  console.log("\nConfiguration:");
  Object.entries(env.vars).forEach(([key, value]) => {
    console.log(`  ${key}="${value}"`);
  });
}

function exportEnvironment(name) {
  const env = environments[name];
  if (!env) {
    console.error(`Environment '${name}' not found`);
    process.exit(1);
  }
  
  // Shell export形式で出力
  Object.entries(env.vars).forEach(([key, value]) => {
    console.log(`export ${key}="${value}"`);
  });
}

// メイン処理
switch (command) {
  case "list":
    listEnvironments();
    break;
  case "show":
    if (!envName) {
      console.error("Environment name required");
      printUsage();
      process.exit(1);
    }
    showEnvironment(envName);
    break;
  case "export":
    if (!envName) {
      console.error("Environment name required");
      printUsage();
      process.exit(1);
    }
    exportEnvironment(envName);
    break;
  default:
    printUsage();
    break;
}