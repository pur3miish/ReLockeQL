import { GraphQLInputObjectType, GraphQLNonNull } from "graphql";

import { name_type } from "../relocke_types/name_type.js";

/**
 * Authorization type for action validation.
 */
export interface Authorization {
  /** Name of the account that is trying to authorize */
  actor: string;
  /** Name of the permission of the actor */
  permission?: string;
}

export const authorization_type = new GraphQLInputObjectType({
  name: "authorization",
  description: "Authorization object type.",
  fields: () => ({
    actor: {
      description: "The name of the account name to sign the transaction.",
      type: new GraphQLNonNull(name_type)
    },
    permission: {
      description: "The name of the account permission.",
      type: name_type,
      defaultValue: "active"
    }
  })
});
