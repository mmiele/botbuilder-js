/**
 * @module botbuilder-dialogs-adaptive-tests
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { BotAdapter, IUserTokenProvider, TurnContext, Activity, ResourceResponse, ConversationReference, TokenResponse, ChannelAccount, RoleTypes, ConversationAccount, Middleware, ActivityTypes, IActivity } from 'botbuilder-core';

export class AdaptiveTestAdapter extends BotAdapter implements IUserTokenProvider {
    private _sendTraceActivity: boolean = false;
    private _nextId: number = 0;

    /**
     * A value indicating whether to send trace activities.
     */
    public get enableTrace(): boolean { return this._sendTraceActivity };
    public set enableTrace(value: boolean) { this._sendTraceActivity = value };

    /**
     * The locale for the conversation.
     */
    public locale: string = 'en-us';

    /**
     * The queue of responses from the bot.
     */
    public activeQueue: Activity[] = [];

    /**
     * A reference to the current conversation.
     */
    public conversation: ConversationReference;

    /**
     * Creates a new AdaptiveTestAdapter instance.
     * @param conversation (Optional) a reference to the conversation to begin the adapter state with.
     * @param sendTraceActivity (Optional) indicates whether the adapter should add to its activeQueue any trace activities generated by the bot.
     */
    constructor(conversation?: ConversationReference, sendTraceActivity: boolean = false) {
        super();
        this._sendTraceActivity = sendTraceActivity;
        if (conversation) {
            this.conversation = conversation;
        } else {
            conversation = {
                channelId: 'test',
                serviceUrl: 'https://test.com',
                user: {
                    id: 'user1',
                    name: 'User1',
                    role: RoleTypes.User
                } as ChannelAccount,
                bot: {
                    id: 'bot',
                    name: 'Bot',
                    role: RoleTypes.Bot
                } as ChannelAccount,
                conversation: {
                    isGroup: false,
                    id: 'convo1',
                    name: 'Conversation1'
                } as ConversationAccount
            } as ConversationReference;
        }
    }

    /**
     * Create a ConversationReference.
     * @param name name of the conversation (also id).
     * @param user name of the user (also id) default: User1.
     * @param bot name of the bot (also id) default: Bot.
     */
    public static createConversation(name: string, user: string = 'User1', bot: string = 'Bot'): ConversationReference {
        return {
            channelId: 'test',
            serviceUrl: 'https://test.com',
            conversation: { isGroup: false, id: name, name: name } as ConversationAccount,
            user: { id: user.toLowerCase(), name: user } as ChannelAccount,
            bot: { id: bot.toLowerCase(), name: bot } as ChannelAccount
        } as ConversationReference;
    }

    /**
     * Adds middleware to the adapter's pipeline.
     * @param middleware The middleware to add.
     */
    public use(middleware: Middleware): this {
        super.use(middleware);
        return this;
    }

    /**
     * Receives an activity and runs it through the middleware pipeline.
     * @param activity The activity to process.
     * @param callback The bot logic to invoke.
     */
    public async processActivity(activity: Activity, callback: (context: TurnContext) => Promise<any>): Promise<any> {
        activity.type = activity.type ? activity.type : ActivityTypes.Message;
        activity.channelId = this.conversation.channelId;

        if (!activity.from || activity.from.id === 'unknown' || activity.from.role === RoleTypes.Bot) {
            activity.from = this.conversation.user;
        }

        activity.recipient = this.conversation.bot;
        activity.conversation = this.conversation.conversation;
        activity.serviceUrl = this.conversation.serviceUrl;
        activity.id = (this._nextId++).toString();

        if (!activity.timestamp) {
            activity.timestamp = new Date();
        }

        const context = new TurnContext(this, activity);
        await this.runMiddleware(context, async (turnContext: TurnContext) => {
            await callback(turnContext);
        });
    }

    /**
     * Sends activities to the conversation.
     * @param context Context for the current turn of conversation.
     * @param activities The activities to send.
     */
    public async sendActivities(context: TurnContext, activities: Activity[]): Promise<ResourceResponse[]> {
        if (!context) {
            throw new Error('TurnContext cannot be null.');
        }

        if (!activities) {
            throw new Error('Activities cannot be null.');
        }

        if (activities.length == 0) {
            throw new Error('Expecting one or more activities, but the array was empty.');
        }

        const responses: ResourceResponse[] = [];

        for (let i = 0; i < activities.length; i++) {
            const activity = activities[i];

            if (!activity.id) {
                activity.id = generate_guid();
            }

            if (!activity.timestamp) {
                activity.timestamp = new Date();
            }

            if (activity.type === 'delay') {
                const delayMs = parseInt(activity.value);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else if (activity.type === ActivityTypes.Trace) {
                if (this._sendTraceActivity) {
                    this.activeQueue.push(activity);
                }
            } else {
                this.activeQueue.push(activity);
            }

            responses.push({ id: activity.id } as ResourceResponse);
        }

        return responses;
    }

    /**
     * Replaces an existing activity in the activeQueue.
     * @param context Context for the current turn of conversation.
     * @param activity New replacement activity.
     */
    public updateActivity(context: TurnContext, activity: Activity): Promise<void> {
        for (let i = 0; i < this.activeQueue.length; i++) {
            if (this.activeQueue[i].id === activity.id) {
                this.activeQueue[i] = activity;
                break;
            }
        }
        return Promise.resolve();
    }

    /**
     * Deletes an existing activity in the activeQueue.
     * @param context Context for the current turn of conversation.
     * @param reference Conversation reference for the activity to delete.
     */
    public deleteActivity(context: TurnContext, reference: ConversationReference): Promise<void> {
        for (let i = 0; i < this.activeQueue.length; i++) {
            if (this.activeQueue[i].id === reference.activityId) {
                this.activeQueue.splice(i, 1);
                break;
            }
        }
        return Promise.resolve();
    }

    /**
     * The `TestAdapter` doesn't implement `continueConversation()` and will return an error if it's
     * called.
     */
    public continueConversation(reference: Partial<ConversationReference>, logic: (revocableContext: TurnContext) => Promise<void>): Promise<void> {
        throw new Error("Method not implemented.");
    }

    /**
     * Dequeues and returns the next bot response from the activeQueue
     */
    public getNextReply(): IActivity {
        if (this.activeQueue.length > 0) {
            return this.activeQueue.shift();
        }
        return undefined;
    }

    /**
     * Creates a message activity from text and the current conversational context.
     * @param text The message text.
     */
    public makeActivity(text?: string): Activity {
        return {
            type: ActivityTypes.Message,
            locale: this.locale,
            from: this.conversation.user,
            recipient: this.conversation.bot,
            conversation: this.conversation.conversation,
            serviceUrl: this.conversation.serviceUrl,
            id: (this._nextId++).toString(),
            text: text
        } as Activity;
    }

    /**
     * Processes a message activity from a user.
     * @param userSays The text of the user's message.
     * @param callback The bot logic to invoke.
     */
    public sendTextToBot(userSays: string, callback: (context: TurnContext) => Promise<any>): Promise<any> {
        return this.processActivity(this.makeActivity(userSays), callback);
    }

    private _userTokens: UserToken[] = [];
    private _magicCodes: TokenMagicCode[] = [];

    /**
     * Adds a fake user token so it can later be retrieved.
     * @param connectionName The connection name.
     * @param channelId The channel id.
     * @param userId The user id.
     * @param token The token to store.
     * @param magicCode (Optional) The optional magic code to associate with this token.
     */
    public addUserToken(connectionName: string, channelId: string, userId: string, token: string, magicCode: string = undefined) {
        const key: UserToken = new UserToken();
        key.ChannelId = channelId;
        key.ConnectionName = connectionName;
        key.UserId = userId;
        key.Token = token;

        if (!magicCode) {
            this._userTokens.push(key);
        }
        else {
            const mc = new TokenMagicCode();
            mc.Key = key;
            mc.MagicCode = magicCode;
            this._magicCodes.push(mc);
        }
    }

    /**
     * Retrieves the OAuth token for a user that is in a sign-in flow.
     * @param context Context for the current turn of conversation with the user.
     * @param connectionName Name of the auth connection to use.
     * @param magicCode (Optional) Optional user entered code to validate.
     */
    public async getUserToken(context: TurnContext, connectionName: string, magicCode?: string): Promise<TokenResponse> {
        const key: UserToken = new UserToken();
        key.ChannelId = context.activity.channelId;
        key.ConnectionName = connectionName;
        key.UserId = context.activity.from.id;

        if (magicCode) {
            var magicCodeRecord = this._magicCodes.filter(x => key.EqualsKey(x.Key));
            if (magicCodeRecord && magicCodeRecord.length > 0 && magicCodeRecord[0].MagicCode === magicCode) {
                // move the token to long term dictionary
                this.addUserToken(connectionName, key.ChannelId, key.UserId, magicCodeRecord[0].Key.Token);

                // remove from the magic code list
                const idx = this._magicCodes.indexOf(magicCodeRecord[0]);
                this._magicCodes = this._magicCodes.splice(idx, 1);
            }
        }

        var match = this._userTokens.filter(x => key.EqualsKey(x));

        if (match && match.length > 0) {
            return {
                connectionName: match[0].ConnectionName,
                token: match[0].Token,
                expiration: undefined
            };
        }
        else {
            // not found
            return undefined;
        }
    }

    /**
     * Signs the user out with the token server.
     * @param context Context for the current turn of conversation with the user.
     * @param connectionName Name of the auth connection to use.
     */
    public async signOutUser(context: TurnContext, connectionName: string): Promise<void> {
        var channelId = context.activity.channelId;
        var userId = context.activity.from.id;

        var newRecords: UserToken[] = [];
        for (var i = 0; i < this._userTokens.length; i++) {
            var t = this._userTokens[i];
            if (t.ChannelId !== channelId ||
                t.UserId !== userId ||
                (connectionName && connectionName !== t.ConnectionName)) {
                newRecords.push(t);
            }
        }
        this._userTokens = newRecords;
    }

    /**
     * Gets a signin link from the token server that can be sent as part of a SigninCard.
     * @param context Context for the current turn of conversation with the user.
     * @param connectionName Name of the auth connection to use.
     */
    public async getSignInLink(context: TurnContext, connectionName: string): Promise<string> {
        return `https://fake.com/oauthsignin/${connectionName}/${context.activity.channelId}/${context.activity.from.id}`;
    }

    /**
     * Signs the user out with the token server.
     * @param context Context for the current turn of conversation with the user.
     * @param connectionName Name of the auth connection to use.
     */
    public async getAadTokens(context: TurnContext, connectionName: string, resourceUrls: string[]): Promise<{
        [propertyName: string]: TokenResponse;
    }> {
        return undefined;
    }

}

/* 
 * This function generates a GUID-like random number that should be sufficient for our purposes of tracking 
 * instances of a given waterfall dialog.
 * Source: https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
 */
function generate_guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

class UserToken {
    public ConnectionName: string;
    public UserId: string;
    public ChannelId: string;
    public Token: string;

    public EqualsKey(rhs: UserToken): boolean {
        return rhs != null &&
            this.ConnectionName === rhs.ConnectionName &&
            this.UserId === rhs.UserId &&
            this.ChannelId === rhs.ChannelId;
    }
}

class TokenMagicCode {
    public Key: UserToken;
    public MagicCode: string;
}
