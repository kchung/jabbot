# Jabbot

A [Jabwire](https://www.jabwire.com) integration with Slack based off of `slackbots`. When a Jabwire ticket (bug or sprint task) is posted in the integration channel, the corressponding ticket with a brief summary will be shown.

## Install

```sh
$ npm install jabbot
```

## Usage

To use this library, you'll need a Jabwire API token and a Slack token.

```js
import Jabbot from 'jabbot';

// Initialize the FullSlate wrapper
const bot = new Jabbot({
  name: 'Your_Jabbot_bot_name',
  token: 'Your_Slack_token',
  api: 'Your_Jabwire_API_key',
});

// Start Jabbot
bot.run();
```

## License
[MIT](LICENSE)