const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();  // Load environment variables from .env file

// Replace these with your actual tokens from the environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;  // Your Discord bot's Client ID
const COC_API_TOKEN = process.env.COC_API_TOKEN;

const CLASH_API_URL = 'https://cocproxy.royaleapi.dev/v1/clans/';

// Custom Town Hall emoji mapping
const TOWNHALL_EMOJIS = {
    1: '<:TH1:1292550066648780954>', 2: '<:TH2:1292548756629098557>', 3: '<:TH3:1292550402415530005>', 4: '<:TH4:1292549074041704619>',
    5: '<:TH5:1292549152005296231>', 6: '<:TH6:1292548893673914462>', 7: '<:TH7:1292548843300454452>', 8: '<:TH8:1292548793920655502>',
    9: '<:TH9:1292548944953344060>', 10: '<:TH10:1292550020054253708>', 11: '<:TH11:1292549115124908042>', 12: '<:TH12:1292550172609347624>',
    13: '<:TH13:1292548987219480578>', 14: '<:TH14:1292550129777377310>', 15: '<:TH15:1292549036062146580>', 16: '<:TH16:1292550648285368400>'
};

// Fetch clan data from the Clash of Clans API
async function fetchClanData(clanTag) {
    const url = `${CLASH_API_URL}%23${clanTag}`;  // %23 is the encoded '#'
    const headers = { Authorization: `Bearer ${COC_API_TOKEN}` };
    
    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Create the Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Register the slash command globally
const commands = [
    new SlashCommandBuilder()
        .setName('claninfo')
        .setDescription('Shows clan overview')
        .addStringOption(option =>
            option.setName('clantag')
                .setDescription('Enter clan tag')
                .setRequired(true)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands globally.');

        // Register slash commands globally
        await rest.put(
            Routes.applicationCommands(CLIENT_ID), // This registers the command globally
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands globally.');
    } catch (error) {
        console.error(error);
    }
})();

// Respond to the claninfo slash command
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'claninfo') {
        const clanTag = interaction.options.getString('clantag').replace('#', '');

        // Defer reply to allow more time for data fetching
        await interaction.deferReply();

        const data = await fetchClanData(clanTag);

        if (!data) {
            await interaction.editReply('Could not fetch clan data. Please try again.');
            return;
        }

        // Find the leader from the member list
        const leader = data.memberList.find(member => member.role === 'leader');
    
        const townhallEmoji = TOWNHALL_EMOJIS[data.requiredTownhallLevel] || '';

        // Group members by Town Hall level
        const townhallCounts = data.memberList.reduce((counts, member) => {
            const thLevel = member.townHallLevel;
            if (!counts[thLevel]) counts[thLevel] = 0;
            counts[thLevel]++;
            return counts;
        }, {});
        
        // Define a mapping for clan types
        const CLAN_TYPE_NAMES = {
            open: 'Anyone Can Join',
            closed: 'Closed',
            inviteOnly: 'Invite Only'
        };

        // Display clan type
        const clanTypeDisplay = CLAN_TYPE_NAMES[data.type] || 'Unknown Type';  // Default to 'Unknown Type' if not found

        // Format the Town Hall compositions
        const townhallComposition = Object.entries(townhallCounts)
            .sort((a, b) => b[0] - a[0])  // Sort by Town Hall level in descending order
            .map(([thLevel, count]) => `${TOWNHALL_EMOJIS[thLevel]} ${count}`)
            .join(' | ');

        // Construct the clan URL
        const clanURL = `https://link.clashofclans.com/en/?action=OpenClanProfile&tag=%23${clanTag}`;

        // Construct the war log visibility status
        const warLogStatus = data.isWarLogPublic 
            ? '**War Log**\n<:Padlock_Unlock:1292540371988906056> Public' 
            : '**War Log**\n<:lock:1292539786204020937> Private';

        // Initialize the War & League field value with the war log status
        let warLeagueValue = `${warLogStatus}\n`;

        // If the war log is public, include losses and ties
        if (data.isWarLogPublic) {
            warLeagueValue += `**War Performance**\n<:GreenTick:1292539531802968204> ${data.warWins} Won \n<:tick:1292539206207537163> ${data.warLosses} Lost <:empty:1292757265191010326> ${data.warTies || '0'} Tied\n`;
        } else {
            warLeagueValue += `**War Performance**\n<:GreenTick:1292539531802968204> ${data.warWins} Won\n`;
        }

        // Always include win streak and war league information
        warLeagueValue += `**Win Streak**\n<:medal:1292841957831213200> ${data.warWinStreak}\n`;
        warLeagueValue += `**War League**\n<:versusbattle:1292533757475029064> ${data.warLeague.name}`;

        // Create the embed with the fetched data
        const embed = {
            color: 0x0099ff,
            title: `${data.name} (${data.tag})`,
            description: `<:trophy:1292533368046620784> ${data.clanPoints} | ️<:BuilderVillage:1292534457991041044> ${data.clanBuilderBasePoints}`,
            thumbnail: { url: data.badgeUrls.medium },
            fields: [
                {
                    name: '\u200b',
                    value: `**<:crown:1292537754194018305> Leader**: ${leader.name}\n`
                         + `**<:clan:1292538471117754419> Clan Level**: ${data.clanLevel}\n`
                         + `<:location:1292838893795807264> **Location**: ${data.location ? data.location.name : 'Unknown'}\n`
                         + `**<:people:1292532596319977556> Members**: ${data.members}/50\n`
                         + `**<:settings:1292550874035392574> Type**: ${clanTypeDisplay}\n\n`
                         + `${data.description}`,
                    inline: false
                },
                {
                    name: 'Requirements',
                    value: `<:trophy:1292533368046620784> ${data.requiredTrophies}+ | ${townhallEmoji} ${data.requiredTownhallLevel}+\n\n`,
                    inline: false
                },
                {
                    name: 'War & League',
                    value: warLeagueValue,
                    inline: false
                },
                {
                    name: 'Clan Capital',
                    value: `**Capital Hall**\n<:emoji_50:1292560483722727434> Level ${data.clanCapital.capitalHallLevel}\n` +
                           `**Capital Trophy**\n<:capitaltrophy:1292537606674933762> ${data.clanCapital.trophyCount}`,
                    inline: false
                },
                {
                    name: 'Town Hall Composition',
                    value: townhallComposition || 'No members found.',
                    inline: false
                }
            ],
            footer: { text: 'Data provided by Clash of Clans API' },
            timestamp: new Date()
        };

        // Send the embed reply
        await interaction.editReply({ embeds: [embed] });
    }
});

// Log in to Discord
client.login(DISCORD_TOKEN);