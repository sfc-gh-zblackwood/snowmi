import snowflake from "snowflake-sdk";
import fs from "fs";
import os from "os";
import toml from "toml";

snowflake.configure({ logLevel: "ERROR" });

let connection: snowflake.Connection | null = null;
let cachedToken: string | null = null;

function getOAuthToken(): string | null {
  const tokenPath = "/snowflake/session/token";
  try {
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, "utf8");
    }
  } catch {
    // Not in SPCS environment
  }
  return null;
}

function getConnectionFromConfig(
  connectionName: string
): snowflake.ConnectionOptions | null {
  const configPath = `${os.homedir()}/.snowflake/config.toml`;
  try {
    if (fs.existsSync(configPath)) {
      const config = toml.parse(fs.readFileSync(configPath, "utf8"));
      const conn = config.connections?.[connectionName];
      if (conn) {
        return {
          account: conn.account,
          username: conn.user,
          password: conn.password,
          warehouse: conn.warehouse || process.env.SNOWFLAKE_WAREHOUSE,
          database: conn.database || process.env.SNOWFLAKE_DATABASE,
          schema: conn.schema || process.env.SNOWFLAKE_SCHEMA,
          role: conn.role,
        };
      }
    }
  } catch (err) {
    console.error("Failed to read config.toml:", err);
  }
  return null;
}

function getConfig(): snowflake.ConnectionOptions {
  const token = getOAuthToken();
  if (token) {
    cachedToken = token;
    return {
      account: process.env.SNOWFLAKE_ACCOUNT || "snowflake",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
      database: process.env.SNOWFLAKE_DATABASE || "SNOWSCIENCE",
      schema: process.env.SNOWFLAKE_SCHEMA || "LLM",
      host: process.env.SNOWFLAKE_HOST,
      token,
      authenticator: "OAUTH",
    };
  }

  const connectionName = process.env.SNOWFLAKE_CONNECTION_NAME || "dev";
  const configConn = getConnectionFromConfig(connectionName);
  if (configConn) {
    return {
      ...configConn,
      database: configConn.database || "SNOWSCIENCE",
      schema: configConn.schema || "LLM",
      warehouse: configConn.warehouse || "COMPUTE_WH",
    };
  }

  return {
    account: process.env.SNOWFLAKE_ACCOUNT || "snowflake",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
    database: process.env.SNOWFLAKE_DATABASE || "SNOWSCIENCE",
    schema: process.env.SNOWFLAKE_SCHEMA || "LLM",
    username: process.env.SNOWFLAKE_USER,
    authenticator: "EXTERNALBROWSER",
  };
}

async function getConnection(): Promise<snowflake.Connection> {
  const token = getOAuthToken();
  if (token && token !== cachedToken && connection) {
    connection.destroy(() => {});
    connection = null;
  }

  if (connection) {
    return connection;
  }

  const config = getConfig();
  connection = snowflake.createConnection(config);

  try {
    await (connection as { connectAsync: (cb: (err: Error | null, conn: snowflake.Connection) => void) => Promise<void> }).connectAsync((err: Error | null) => {
      if (err) throw err;
    });
    return connection!;
  } catch (err) {
    connection = null;
    throw err;
  }
}

export async function query<T>(sql: string, retries = 1): Promise<T[]> {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      complete: (err, _stmt, rows) => {
        if (err) {
          if (retries > 0 && err.message?.includes("token")) {
            connection = null;
            return query<T>(sql, retries - 1)
              .then(resolve)
              .catch(reject);
          }
          reject(err);
        } else {
          resolve((rows || []) as T[]);
        }
      },
    });
  });
}
