const express = require('express');
const morgan = require('morgan');
const Slack = require('slack-node');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Setup
 */
const channel = process.env.SLACK_CHANNEL;
const allowedPlexWebhooks = {
  'media.play': 'Started',
  'media.scrobble': 'Finished',
  'media.rate': 'Rated',
  'library.new': 'Added'
};

/**
 * Slack
 */
const slack = new Slack();
slack.setWebhook(process.env.SLACK_URL);

/**
 * Express
 */
const app = express();
const port = process.env.PORT || 3000;

app.use(morgan('dev'));
app.listen(port, () => {
  console.log(`Express app running at http://localhost:${port}`);
});

/**
 * Express Routes
 */
app.post('/', upload.single('thumb'), (req, res, next) => {
  const payload = JSON.parse(req.body.payload);

  if (Object.keys(allowedPlexWebhooks).includes(payload.event)) {
    console.log(`Notifying slack for event ${payload.event}`);
    notifySlack(payload, allowedPlexWebhooks[payload.event]);
  } else {
    console.log(`${payload.event} is not an allowed webhook`);
  }

  res.sendStatus(200);
});

/**
 * Error Handlers
 */

app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send(err.message);
});

/**
 * Helper Methods
 */

function formatTitle(metadata) {
  if (metadata.grandparentTitle) {
    return metadata.grandparentTitle;
  } else {
    let ret = metadata.title;
    if (metadata.year) {
      ret += ` (${metadata.year})`;
    }
    return ret;
  }
}

function formatSubtitle(metadata) {
  let ret = '';

  if (metadata.grandparentTitle) {
    if (metadata.type === 'track') {
      ret = metadata.parentTitle;
    } else if (metadata.index && metadata.parentIndex) {
      ret = `S${metadata.parentIndex} E${metadata.index}`;
    } else if (metadata.originallyAvailableAt) {
      ret = metadata.originallyAvailableAt;
    }

    if (metadata.title) {
      ret += ' - ' + metadata.title;
    }
  } else if (metadata.type === 'movie') {
    ret = metadata.summary ? metadata.summary : metadata.tagline;
  }

  return ret;
}

function notifySlack(payload, action) {
  slack.webhook(
    {
      channel,
      username: 'Plex',
      icon_emoji: ':plex:',
      attachments: [
        {
          fallback: 'Required plain-text summary of the attachment.',
          color: '#a67a2d',
          title: formatTitle(payload.Metadata),
          text: formatSubtitle(payload.Metadata),
          footer: `${action} by ${payload.Account.title} on ${payload.Server.title}`,
          footer_icon: payload.Account.thumb
        }
      ]
    },
    () => {}
  );
}
