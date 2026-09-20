/**
 * Every task in the product. Registered here so that the deterministic-first and budget rules
 * can be asserted over the whole set rather than remembered per task.
 */

import type { TaskDefinition } from "./task.ts";
import { classifyDocument } from "./tasks/classify-document.ts";
import { extractDocument } from "./tasks/extract-document.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TASKS: readonly TaskDefinition<any, any>[] = [classifyDocument, extractDocument];
