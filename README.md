# hexo-twitter-auto-publish

## Install

`npm i hexo-twitter-auto-publish`

## Configuration

Twitter account config via shell variables

```bash
export TWITTER_CONSUMER_KEY=h2jOUdwVwCTRnM6zVeRC9fVhD
export TWITTER_CONSUMER_SECRET=fq4eY5NmK2X9ZxSDSUaFqMBPWWMUCCYu35PMvzoqB0YzqLOTEs
export TWITTER_ACCESS_TOKEN_KEY=929842798974656517-wrwhE2hNL5whclsgjWZ2PlGkuaAUIda
export TWITTER_ACCESS_TOKEN_SECRET=RSbflHTBwAjUKZTeKk7lChzZrjbcoPh71wQuxth4ZErmj
```

or using `_config.yml`

```bash
twitterAutoPublish:
  consumerKey: h2jOUdwVwCTRnM6zVeRC9fVhD
  consumerSecret: fq4eY5NmK2X9ZxSDSUaFqMBPWWMUCCYu35PMvzoqB0YzqLOTEs
  accessTokenKey: 929842798974656517-wrwhE2hNL5whclsgjWZ2PlGkuaAUIda
  accessTokenSecret: RSbflHTBwAjUKZTeKk7lChzZrjbcoPh71wQuxth4ZErmj
```

## About twitter-db.json

There are three fields in the database: `published`, `to-publish`, `to-destroy`.

- `published` - contains posts that are already on twitter and each post has a tweetId.

- `to-publish` - contains all new posts that have not yet appeared on Twitter.

- `to-destroy` - contains posts that for some reason have been moved to a working version, or we changed the twitterAutoPublish in the page from true to false.
  
**If you do not want a post to be sent to twitter, all you have to do is move it from `to-publish` to `published`.**

**New statuses are sent to the twitter only after calling the command: `hexo deploy`, or after calling a custom command: `hexo twitter-publish`.**