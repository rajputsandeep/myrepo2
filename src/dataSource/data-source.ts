// import "reflect-metadata";
// import { DataSource } from "typeorm";
// import { SuperAdmin } from "../entities/SuperAdmin";
// import { Client } from "../entities/Client";

// import { config } from "../config";
// const isProd = process.env.NODE_ENV === 'production';
// const wantSSL = (process.env.DB_SSL || '').toLowerCase() === 'true' || isProd;

// export const AppDataSource = new DataSource({
//   type: "postgres",
//   //  url:config.url,
//   host: config.db.host,
//   port: config.db.port,
//   username: config.db.username,
//   password: config.db.password,
//   database: config.db.database,
  
 
//   entities: [ ],
//   migrations: [__dirname + "/migrations/*.{ts,js}"],

//   // ⚡ Development mode
//   synchronize: process.env.NODE_ENV !== "production",

//   // helpful for debugging
//   logging: process.env.NODE_ENV !== "production",
//  ssl: wantSSL ? { rejectUnauthorized: true } : false,
//   extra: {
//     max: Number(process.env.DB_MAX || 10),
//     connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT || 5000),
//     idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 10000),
//     ...(wantSSL ? { ssl: { rejectUnauthorized: true } } : {}),
//   },

// });
// // import "reflect-metadata";
// // import { DataSource } from "typeorm";
// // import { TenantAccount } from "../entities/TenantAccount";
// // import { AccountContact } from "../entities/AccountContact";
// // import { Role } from "../entities/Role";
// // import { Permission } from "../entities/Permission";
// // import { AppUser } from "../entities/AppUser";
// // import { TwoFactor } from "../entities/TwoFactor";
// // import { TenantLicense } from "../entities/TenantLicense";
// // import { PasswordReset } from "../entities/PasswordReset";
// // import { TokenBlacklist } from "../entities/TokenBlacklisted";
// // import { config } from "../config";
 
// // const isProd = process.env.NODE_ENV === 'production';
// // const wantSSL = (process.env.DB_SSL || '').toLowerCase() === 'true' || isProd;
 
// // export const AppDataSource = new DataSource({
// //   type: "postgres",
// //   host: config.db.host,
// //   port: config.db.port,
// //   username: config.db.username,
// //   password: config.db.password,
// //   database: config.db.database,
 
// //   entities: [
// //     TenantAccount,
// //     AccountContact,
// //     Role,
// //     Permission,
// //     AppUser,
// //     TwoFactor,
// //     TenantLicense,
// //     PasswordReset,
// //     TokenBlacklist
// //   ],
// //   migrations: [__dirname + "/migrations/*.{ts,js}"],
 
// //   /**
// //    * 🔹 Important for demo:
// //    * Make sure tables auto-create from entities
// //    */
// //   synchronize: true,   // 👈 force enabled for demo
// //   logging: !isProd,    // keep logs off in production
// //   // ssl: wantSSL ? { rejectUnauthorized: true } : false,
// // });


import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "../config";

const isProd = process.env.NODE_ENV === "production";
const wantSSL = (process.env.DB_SSL || "").toLowerCase() === "true" || isProd;

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,

  /**
   * ✅ Load all entity files automatically
   * Supports both TS (dev) and JS (prod build).
   */
  entities: [__dirname + "/../entities/*.{ts,js}"],

  migrations: [__dirname + "/migrations/*.{ts,js}"],
 
  synchronize: process.env.NODE_ENV !== "production",



  // synchronize: true,   // 👈 force enabled for demo
  logging: !isProd,    // keep logs off in production
 ssl: wantSSL ? { rejectUnauthorized: true } : false,

});


