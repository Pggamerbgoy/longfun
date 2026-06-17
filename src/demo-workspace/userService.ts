import { Database } from "./database";
export class UserService { constructor(private db: Database) {} getUser() { return "User A"; } }