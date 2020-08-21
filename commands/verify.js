const mongo = require('../mongo');
const fetch = require('node-fetch');
const settings = require('../settings');

const nodemailer = require("nodemailer");
const mailAccount = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});

module.exports = {
    name: 'verify',
    description: 'Verify your UW identity for server access',
    args: true,
    guildOnly: true,
    async execute(message, args) {
        let uwid = args[0].toLowerCase().replace(/[^a-z0-9.@-]/g, "");

        if (uwid.endsWith("@uwaterloo.ca")) {
            uwid = uwid.slice(0, -13);
        }

        // check if user already exists
        const existingUser = await mongo.getDB().collection("users").findOne({ uwid: uwid });
        if (existingUser) {
            if (existingUser.discordID === message.author.id) {
                if (existingUser.verified) {
                    // TODO: auto confirm user
                    return message.reply('Thanks for verifying!');
                } else {
                    return message.reply('We\'ve already sent you a verification code! Please check your email');
                }
                
            } else {
                return message.reply(`That user ID has already been registered. If you think this is a mistake, message <@${process.env.ADMIN_ID}>`, { "allowedMentions": { "users": [] } });
            }
        }

        const request = await fetch(`https://api.uwaterloo.ca/v2/directory/${uwid}.json?key=${process.env.UW_API_KEY}`);
        const userData = await request.json();

        if (userData.meta.status === 204) {
            return message.reply('There\'s no Waterloo account associated with that user ID! Please double check the user ID and try again')
        };
        let user = {
            discordID: message.author.id,
            program: userData.data.department,
            uwid: [],
            verified: false,
            token: Math.floor(Math.random() * 899999 + 100000)
        }
        userData.data.email_addresses.forEach(email => {
            user.uwid.push(email.slice(0, -13));
        });
        mongo.getDB().collection("users").replaceOne({ discordID: message.author.id }, user, { upsert: true });

        mailAccount.sendMail({
            from: `"Sir Goose Bot 👻" <${process.env.EMAIL}>`,
            to: `${uwid}@uwaterloo.ca`,
            subject: `UW Verification Code [${user.token}]`,
            text: `Token: ${user.token}`,
            html: `<b>HONK</b></br>
                Hey, your verification code is: <b>${user.token}</b></br>
                You can verify yourself using this command in the Discord channel:</br>
                <code>${settings.get(message.guild?.id).prefix}confirm ${user.token}</code>
                </br></br>
                Also! If you have time, reply to this email with something random to prevent this account from being flagged as spam.`,
        });
        message.channel.send(
            `I'm sending a token to your UW email!\nGo ahead and type \`${settings.get(message.guild?.id).prefix}confirm TOKEN\` to finish the verification process`
        );
    }
}