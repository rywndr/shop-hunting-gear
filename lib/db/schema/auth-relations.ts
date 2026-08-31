import { defineRelationsPart } from "drizzle-orm"

import { account, session, user, verification } from "./auth"

export const authRelations = defineRelationsPart(
  {
    user,
    session,
    account,
    verification,
  },
  (relations) => ({
    user: {
      sessions: relations.many.session({
        from: relations.user.id,
        to: relations.session.userId,
      }),
      accounts: relations.many.account({
        from: relations.user.id,
        to: relations.account.userId,
      }),
    },
    session: {
      user: relations.one.user({
        from: relations.session.userId,
        to: relations.user.id,
      }),
    },
    account: {
      user: relations.one.user({
        from: relations.account.userId,
        to: relations.user.id,
      }),
    },
  })
)
