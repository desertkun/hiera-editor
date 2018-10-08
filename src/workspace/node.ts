import {ipc} from "../ipc/client";

const $ = require("jquery");

export async function setup(data: any)
{
   const info = await ipc.findNode(data.node);
   const a = 0;
}
