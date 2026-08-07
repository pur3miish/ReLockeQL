import {
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull
} from "graphql";

export const actions_type = (
  fields: GraphQLInputFieldConfigMap,
  typeResolution = ""
): GraphQLNonNull<GraphQLList<GraphQLNonNull<GraphQLInputObjectType>>> =>
  new GraphQLNonNull(
    new GraphQLList(
      new GraphQLNonNull(
        new GraphQLInputObjectType({
          name: "actions_type" + typeResolution,
          fields
        })
      )
    )
  );
