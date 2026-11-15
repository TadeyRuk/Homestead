// seat 3 (S3-08, S3-09): the mission report that ends every run, replacing the report stub
import { registerScene } from "../core/scene";
import { reportScene } from "./scene";

registerScene("report", reportScene);
