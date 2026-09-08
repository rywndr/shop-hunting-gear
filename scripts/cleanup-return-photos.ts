import "dotenv/config"

import { cleanupOrphanReturnPhotos } from "../lib/returns/photos"

cleanupOrphanReturnPhotos()
  .then((result) => {
    console.info(
      JSON.stringify({ event: "returns.photo_gc_completed", ...result })
    )
    if (result.failed > 0) process.exitCode = 1
  })
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "returns.photo_gc_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    )
    process.exitCode = 1
  })
