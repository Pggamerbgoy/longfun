import { UserService } from "./userService";
import { Database } from "./database";
export class AuthController { login() { const db = new Database(); const s = new UserService(db); return s.getUser(); } }