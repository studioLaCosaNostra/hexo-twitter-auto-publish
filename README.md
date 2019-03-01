# hexo-twitter-auto-publish

## Install

`npm i hexo-twitter-auto-publish`

## Configuration

Twitter account config via shell variables

```bash
export TWITTER_CONSUMER_KEY=Xegp8XDTMqVxcI2tId1juT70X
export TWITTER_CONSUMER_SECRET=oaGaU06IGqaTfObZnYdrYmDvxiHcHck8TQ9Xk61Ze1ghjHQYkP
export TWITTER_ACCESS_TOKEN_KEY=929842798974656517-VuQxIuoLhtoeqW71LofX6M5fIw8Pf3c
export TWITTER_ACCESS_TOKEN_SECRET=R5RZtQj5tLWbSgFx39lq6cd2AcIQRjQk5kbepOobxCplA
```

or using `_config.yml`

```bash
twitterAutoPublish:
  consumerKey: Xegp8XDTMqVxcI2tId1juT70X
  consumerSecret: fq4eY5NmK2X9ZxSDSUaFqMBPWWMUCCYu35PMvzoqB0YzqLOTEs
  accessTokenKey: 929842798974656517-VuQxIuoLhtoeqW71LofX6M5fIw8Pf3c
  accessTokenSecret: R5RZtQj5tLWbSgFx39lq6cd2AcIQRjQk5kbepOobxCplA
```

## About twitter-db.json

There are three fields in the database: `published`, `to-publish`, `to-destroy`.

- `published` - contains posts that are already on twitter and each post has a tweetId.

- `to-publish` - contains all new posts that have not yet appeared on Twitter.

- `to-destroy` - contains posts that for some reason have been moved to a working version, or we changed the twitterAutoPublish in the page from true to false.
  
**If you do not want a post to be sent to twitter, all you have to do is move it from `to-publish` to `published`.**

**New statuses are sent to the twitter only after calling the command: `hexo deploy`, or after calling a custom command: `hexo twitter-publish`.**