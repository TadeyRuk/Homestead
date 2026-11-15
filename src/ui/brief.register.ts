// seat 3 (S3-04): the mission card that opens every run, replacing the brief stub
import { onEnterPhase } from "../core/phases";
import { registerScene } from "../core/scene";
import { registerRule } from "../core/step";
import { briefRule, briefScene, resetReady } from "./brief";

onEnterPhase("brief", () => resetReady());
registerRule("brief", briefRule);
registerScene("brief", briefScene);
