import FileAsync from 'lowdb/adapters/FileAsync';
import TwitterApi from 'twitter-api-v2';
import camelcase from 'camelcase';
import low from 'lowdb';

declare var hexo: any;
const adapter = new FileAsync('twitter-db.json');

interface Document {
  layout: string;
  permalink: string;
  title: string;
  published: boolean;
  twitterAutoPublish: boolean;
  tweetMessage?: string;
  tags: (string | { name: string })[];
}

type TwitterActions = {
  updateDB(document: Document, hexoPublished: boolean): Promise<void>;
  publish(): Promise<void>;
  cleanToPublish(): Promise<void>;
}

interface DocumentInfo {
  title: string;
  permalink: string;
  tags: string[];
  tweetMessage?: string;
  hexoPublished: boolean;
  tweetId?: string;
}

interface DbSchema {
  'published': DocumentInfo[];
  'to-destroy': DocumentInfo[];
  'to-publish': DocumentInfo[];
}

interface Config {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

function validateConfig() {
  return !((
    process.env.TWITTER_CONSUMER_KEY
    && process.env.TWITTER_CONSUMER_SECRET
    && process.env.TWITTER_ACCESS_TOKEN_KEY
    && process.env.TWITTER_ACCESS_TOKEN_SECRET
  )
    ||
    (
      hexo.config.twitterAutoPublish
      && hexo.config.twitterAutoPublish.consumerKey
      && hexo.config.twitterAutoPublish.consumerSecret
      && hexo.config.twitterAutoPublish.accessTokenKey
      && hexo.config.twitterAutoPublish.accessTokenSecret
    ));
}

function twitterConfig(): Config {
  if (validateConfig()) {
    throw new Error('Missing hexo-twitter-auto-publish configuration');
  }
  return {
    appKey: process.env.TWITTER_CONSUMER_KEY || hexo.config.twitterAutoPublish.consumerKey,
    appSecret: process.env.TWITTER_CONSUMER_SECRET || hexo.config.twitterAutoPublish.consumerSecret,
    accessToken: process.env.TWITTER_ACCESS_TOKEN_KEY || hexo.config.twitterAutoPublish.accessTokenKey,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || hexo.config.twitterAutoPublish.accessTokenSecret
  }
}

async function setupTwitter(db: low.LowdbAsync<DbSchema>): Promise<TwitterActions> {
  await db.defaults({ 'published': [], 'to-destroy': [], 'to-publish': [] }).write();
  return {
    async updateDB({ title, permalink, tags, tweetMessage }: Document, hexoPublished: boolean) {
      await db.read();
      const published = db.get('published').find({ permalink }).value();
      if (published) {
        if (!hexoPublished) {
          await db.get('to-destroy').push(published).write();
          await db.get('to-publish').remove({ permalink }).write();
        }
      } else {
        if (hexoPublished) {
          const tagNames: string[] = tags ? tags.map((tag: any) => tag.name || tag) : [];
          const data = {
            title,
            permalink,
            hexoPublished,
            tweetMessage,
            tags: tagNames
          };
          const document = db.get('to-publish').find({ permalink });
          if (document.value()) {
            await document.assign(data).write();
          } else {
            await db.get('to-publish').push(data).write();
          }
        } else {
          await db.get('to-publish').remove({ permalink }).write();
        }
      }
    },
    async publish() {
      await db.read();
      const toDestroy = db.get('to-destroy').value();
      const toPublish = db.get('to-publish').value();
      try {
        const client = new TwitterApi(twitterConfig());
        await Promise.all(toDestroy.map(async (documentInfo: DocumentInfo) => {
          const { tweetId } = documentInfo;
          try {
            await client.v2.deleteTweet(String(tweetId));;
            await db.get('published').remove({ tweetId }).write();
            await db.get('to-destroy').remove({ tweetId }).write();
          } catch (error) {
            throw new Error(`id: ${tweetId}\n${JSON.stringify(error)}`);
          }
        }));
        await Promise.all(toPublish.map(async (documentInfo: DocumentInfo) => {
          const { title, tags, permalink, tweetMessage } = documentInfo;
          const hashedTags = tags.map(tag => `#${camelcase(tag)}`).join(' ');
          const status = tweetMessage ? `${tweetMessage} ${hashedTags} ${permalink}` : `${title} ${hashedTags} ${permalink}`;
          try {
            const tweet = await client.v2.tweet(status);
            await db.get('published').push({
              ...documentInfo,
              tweetId: tweet.data.id
            }).write();
            await db.get('to-publish').remove({ permalink }).write();
          } catch (error) {
            throw new Error(`${status}\n${JSON.stringify(error)}`);
          }
        }));
      } catch (error) {
        hexo.log.error(error);
      }
    },
    async cleanToPublish() {
      await db.get('to-publish').remove().write();
    }
  }
}

function processDocument(updateDB: (document: Document, hexoPublished: boolean) => Promise<void>) {
  return async (document: Document) => {
    const publishedPost: boolean = document.layout === 'post' && document.published;
    const publishedPage: boolean = document.layout !== 'post' && document.twitterAutoPublish !== false;
    const hexoPublished: boolean = publishedPost || publishedPage;
    await updateDB(document, hexoPublished);
    return document;
  }
}

async function registerFilters(cleanToPublish: () => Promise<void>, updateDB: (document: Document, hexoPublished: boolean) => Promise<void>) {
  const updateDocumentDB = processDocument(updateDB);
  hexo.extend.filter.register('after_post_render', updateDocumentDB, { async: true });
  hexo.extend.filter.register('after_generate', async () => {
    await cleanToPublish();
    const posts = hexo.locals.get('posts');
    for (var index = 0; index < posts.length; index++) {
      const post = posts.data[index];
      await updateDocumentDB(post);
    }
    const pages = hexo.locals.get('pages');
    for (var index = 0; index < pages.length; index++) {
      const page = pages.data[index];
      await updateDocumentDB(page);
    }
  }, { async: true });
}

function watchHexoDeployAfter(twitterPublish: () => Promise<void>) {
  hexo.on('deployAfter', function () {
    twitterPublish();
  });
}

function registerConsoleCommandPublish() {
  hexo.extend.console.register('twitter-publish', 'Twitter publish posts.', async () => {
    const db = await low(adapter);
    const twitter: TwitterActions = await setupTwitter(db);
    twitter.publish();
  });
}
registerConsoleCommandPublish();

async function start() {
  const db = await low(adapter);
  const twitter: TwitterActions = await setupTwitter(db);
  registerFilters(twitter.cleanToPublish, twitter.updateDB);
  watchHexoDeployAfter(twitter.publish);
}
start();
