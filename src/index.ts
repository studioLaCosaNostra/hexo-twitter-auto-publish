import low from 'lowdb';
import FileAsync from 'lowdb/adapters/FileAsync';
import Twitter from 'twitter';

declare var hexo: any;
const adapter = new FileAsync('twitter-db.json');

interface Document {
  layout: string;
  permalink: string;
  title: string;
  published: boolean;
  twitterAutoPublish: boolean;
  tags: (string | { name: string })[];
}

type TwitterActions = {
  updateDB(document: Document, hexoPublished: boolean): Promise<void>;
  publish(): Promise<void>;
}

interface DocumentInfo {
  title: string;
  permalink: string;
  tags: string[];
  hexoPublished: boolean;
  tweetId?: string;
}

interface DbSchema {
  'published': DocumentInfo[];
  'to-destroy': DocumentInfo[];
  'to-publish': DocumentInfo[];
}

interface Config {
  consumer_key: string;
  consumer_secret: string;
  access_token_key: string;
  access_token_secret: string;
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

const camelize = (text: string) => {
  return text.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}

function twitterConfig(): Config {
  if (validateConfig()) {
    throw new Error('Missing hexo-twitter-auto-publish configuration');
  }
  return {
    consumer_key: process.env.TWITTER_CONSUMER_KEY || hexo.config.twitterAutoPublish.consumerKey,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET || hexo.config.twitterAutoPublish.consumerSecret,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY || hexo.config.twitterAutoPublish.accessTokenKey,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET || hexo.config.twitterAutoPublish.accessTokenSecret
  }
}

function setupTwitter(db: low.LowdbAsync<DbSchema>): TwitterActions {
  db.defaults({ 'published': [], 'to-destroy': [], 'to-publish': [] }).write();
  return {
    async updateDB({ title, permalink, tags }: Document, hexoPublished: boolean) {
      await db.read();
      const published = db.get('published').find({ permalink }).value();
      if (published) {
        if (!hexoPublished) {
          await db.get('to-destroy').push(published).write();
          await db.get('to-publish').remove({ permalink }).write();
          await db.get('published').remove({ permalink }).write();
        }
      } else {
        if (hexoPublished) {
          const tagNames: string[] = tags ? tags.map((tag: any) => tag.name || tag) : [];
          const data = { 
            title,
            permalink,
            hexoPublished,
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
      const toDestroy = await db.get('to-destroy').value();
      const toPublish = await db.get('to-publish').value();
      try {
        const client = new Twitter(twitterConfig());
        await Promise.all(toDestroy.map(async (documentInfo: DocumentInfo) => {
          const { tweetId } = documentInfo;
          try {
            await client.post(`statuses/destroy/${tweetId}`, {});
            await db.get('published').remove({ tweetId }).write();
            await db.get('to-destroy').remove({ tweetId }).write();
          } catch (error) {
            throw new Error(`id: ${tweetId}\n${JSON.stringify(error)}`);
          }
        }));
        await Promise.all(toPublish.map(async (documentInfo: DocumentInfo) => {
          const { title, tags, permalink } = documentInfo;
          const hashedTags = tags.map(tag => `#${camelize(tag)}`).join(' ');
          const status =  `${title} ${hashedTags} ${permalink}`;
          try {
            const tweet = await client.post('statuses/update', { status });
            await db.get('published').push({ 
              ...documentInfo, 
              tweetId: tweet.id_str
            }).write();
            await db.get('to-publish').remove({ permalink }).write();
          } catch (error) {
            throw new Error(`${status}\n${JSON.stringify(error)}`);
          }
        }));
      } catch (error) {
        hexo.log.error(error);
      }
    }
  }
}

function watchHexoPostRenderEvent(updateDB: (document: Document, hexoPublished: boolean) => Promise<void>) {
  hexo.extend.filter.register('after_post_render', async (document: Document) => {
    const publishedPost: boolean = document.layout === 'post' && document.published;
    const publishedPage: boolean = document.layout !== 'post' && document.twitterAutoPublish !== false;
    const hexoPublished: boolean = publishedPost || publishedPage;
    await updateDB(document, hexoPublished);
    return document;
  });
}

function watchHexoDeployAfter(twitterPublish: () => Promise<void>) {
  hexo.on('deployAfter', function () {
    twitterPublish();
  });
}

function registerConsoleCommandPublish(twitterPublish: () => Promise<void>) {
  hexo.extend.console.register('twitter-publish', 'Twitter publish posts.', function () {
    twitterPublish();
  });
}

async function start() {
  const db = await low(adapter);
  const twitter: TwitterActions = setupTwitter(db);
  watchHexoPostRenderEvent(twitter.updateDB);
  watchHexoDeployAfter(twitter.publish);
  registerConsoleCommandPublish(twitter.publish);
}
start();