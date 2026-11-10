import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clinicRouter from "./clinic";
import chatRouter from "./chat";
import smapPilotRouter from "./smap-pilot";
import operatorPilotRouter from "./operator-pilot";
import schemeReferenceRouter from "./scheme-references";
import hermesLocalCheckRouter from "./hermes-local-check";
import { vaultRouter } from "./vault";

const router: IRouter = Router();
router.use("/clinic", clinicRouter);

router.use(healthRouter);
router.use(chatRouter);
router.use(smapPilotRouter);
router.use(operatorPilotRouter);
router.use(schemeReferenceRouter);
router.use(hermesLocalCheckRouter);
router.use("/ruang-simpan", vaultRouter);

export default router;
