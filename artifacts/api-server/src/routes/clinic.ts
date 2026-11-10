import { pool } from "@workspace/db";
import { createChatService } from "../lib/chat-service";
import { clinicAdmin } from "../lib/clinic-admin";
import { createClinicRouter } from "../lib/clinic-router";

const service = createChatService();
export default createClinicRouter({ pool, member: authorization => service.requireMember(authorization), admin: clinicAdmin });
