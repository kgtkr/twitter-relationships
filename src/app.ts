import { readConfig } from "./config";
import { Twitter } from "./adaptors/twitter";
import { createTwit } from "./twit";
import uuid from "uuid/v4";
import * as S from "fp-ts/lib/Set";
import { pipe } from "fp-ts/lib/function";
import { Discord } from "./adaptors/discord";
import { mkEmbedUser } from "./mk-embed-user";
import { inspect } from "util";
import { PrismaClient, users } from ".prisma/client";
import { Eq as EqString } from "fp-ts/lib/string";
import { Decimal } from "@prisma/client/runtime";

(async () => {
  const config = await readConfig();
  const prisma = new PrismaClient();
  while (true) {
    console.log("job start");
    for (let { token, discord_hook_url } of config.accounts) {
      const now = new Date();
      try {
        const twitter = new Twitter(createTwit(token));
        const discord = new Discord();

        const userId = await twitter.fetchAuthUserId();

        const prevFollowerIds = await (async () => {
          const prevFollowerRecord = await prisma.ff_records.findFirst({
            where: {
              user_id: userId,
              type: "FOLLOWER",
            },
            orderBy: {
              created_at: "desc",
            },
          });

          if (prevFollowerRecord === null) {
            return new Set<string>();
          }

          const prevFollowers = await prisma.ff_record_aggregates.findMany({
            where: {
              ff_record_id: prevFollowerRecord.id,
            },
          });

          return new Set(
            prevFollowers.map(({ user_id }) => user_id.toString())
          );
        })();

        const prevFriendsIds = await (async () => {
          const prevFriendRecord = await prisma.ff_records.findFirst({
            where: {
              user_id: userId,
              type: "FRIEND",
            },
            orderBy: {
              created_at: "desc",
            },
          });

          if (prevFriendRecord === null) {
            return new Set<string>();
          }

          const prevFriends = await prisma.ff_record_aggregates.findMany({
            where: {
              ff_record_id: prevFriendRecord.id,
            },
          });

          return new Set(prevFriends.map(({ user_id }) => user_id.toString()));
        })();

        const followerIds = await twitter
          .fetchFollowers(userId)
          .then((x) => new Set(x));
        const friendIds = await twitter
          .fetchFriends(userId)
          .then((x) => new Set(x));

        const additionFollowerIds = S.difference(EqString)(
          followerIds,
          prevFollowerIds
        );
        const deletionFollowerIds = S.difference(EqString)(
          prevFollowerIds,
          followerIds
        );

        const additionFriendIds = S.difference(EqString)(
          friendIds,
          prevFriendsIds
        );
        const deletionFriendIds = S.difference(EqString)(
          prevFriendsIds,
          friendIds
        );

        await prisma.ff_records.create({
          data: {
            id: uuid(),
            user_id: userId,
            created_at: now,
            type: "FOLLOWER",
            diffs: {
              create: [
                ...Array.from(additionFollowerIds).map((id) => ({
                  user_id: new Decimal(id),
                  type: "ADDITION" as const,
                })),
                ...Array.from(deletionFollowerIds).map((id) => ({
                  user_id: new Decimal(id),
                  type: "DELETION" as const,
                })),
              ],
            },
          },
        });

        await prisma.ff_records.create({
          data: {
            id: uuid(),
            user_id: userId,
            created_at: now,
            type: "FRIEND",
            diffs: {
              create: [
                ...Array.from(additionFriendIds).map((id) => ({
                  user_id: new Decimal(id),
                  type: "ADDITION" as const,
                })),
                ...Array.from(deletionFriendIds).map((id) => ({
                  user_id: new Decimal(id),
                  type: "DELETION" as const,
                })),
              ],
            },
          },
        });

        const requireUserIds = pipe(
          new Set<string>(),
          S.union(EqString)(additionFollowerIds),
          S.union(EqString)(deletionFollowerIds),
          S.union(EqString)(additionFriendIds),
          S.union(EqString)(deletionFriendIds)
        );

        if (requireUserIds.size !== 0) {
          const cachedRequireUsers = await prisma.users.findMany({
            where: {
              id: {
                in: Array.from(requireUserIds),
              },
            },
          });

          const fetchedRequireUsers_ = await twitter.lookupUsers(
            Array.from(
              S.difference(EqString)(
                requireUserIds,
                new Set(cachedRequireUsers.map(({ id }) => id.toString()))
              )
            )
          );

          const fetchedRequireUsers = fetchedRequireUsers_.map((user) => ({
            id: new Decimal(user.id_str),
            created_at: now,
            json: user,
          }));

          await prisma.user_records.createMany({
            data: fetchedRequireUsers,
          });

          const userMap = new Map<string, users>();
          for (let user of cachedRequireUsers) {
            userMap.set(user.id.toString(), user);
          }
          for (let user of fetchedRequireUsers) {
            userMap.set(user.id.toString(), user);
          }

          for (const ids of Array.from(additionFollowerIds)) {
            await discord.postHook(discord_hook_url, {
              content: "新しいフォロワー",
              embeds: [mkEmbedUser(ids, userMap.get(ids))],
            });
          }

          for (const ids of Array.from(deletionFollowerIds)) {
            await discord.postHook(discord_hook_url, {
              content: "去ったフォロワー",
              embeds: [mkEmbedUser(ids, userMap.get(ids))],
            });
          }

          for (const ids of Array.from(additionFriendIds)) {
            await discord.postHook(discord_hook_url, {
              content: "新しいフォロイー",
              embeds: [mkEmbedUser(ids, userMap.get(ids))],
            });
          }

          for (const ids of Array.from(deletionFriendIds)) {
            await discord.postHook(discord_hook_url, {
              content: "去ったフォロイー",
              embeds: [mkEmbedUser(ids, userMap.get(ids))],
            });
          }
        }
      } catch (e) {
        console.error(inspect(e, { depth: null }));
      }
    }
    console.log("job end");
    await new Promise((resolve) => setTimeout(resolve, config.interval * 1000));
  }
})();
