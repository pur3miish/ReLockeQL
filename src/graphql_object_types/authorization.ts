import { GraphQLObjectType, GraphQLString } from "graphql";

export interface AuthorizationType {
  actor: string;
  permission?: string;
}

export const authorization_type = new GraphQLObjectType<AuthorizationType>({
  name: "authorization_type",
  description: "An account permission that authorized an action.",
  fields: (): Record<keyof AuthorizationType, any> => ({
    actor: {
      type: GraphQLString,
      description: "Account that authorized the action."
    },
    permission: {
      type: GraphQLString,
      description: "Permission used by the authorizing account."
    }
  })
});
