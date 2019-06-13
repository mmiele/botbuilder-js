const { DialogTestClient } = require('../');
const { ComponentDialog, TextPrompt, WaterfallDialog, DialogTurnStatus, DialogSet } = require('botbuilder-dialogs');
const assert = require('assert');


describe('DialogTestClient', function() {

    it('should create a DialogTestClient', async function() {
        let client = new DialogTestClient();
        assert(client instanceof DialogTestClient, 'Created an invalid object');
    });

    it('should process a single turn waterfall dialog', async function() {

        let dialog = new WaterfallDialog('waterfall', [
            async(step) => {
                await step.context.sendActivity('hello');
                return step.endDialog();
            }
        ]);

        let client = new DialogTestClient(dialog);
        let reply = await client.sendActivity('hello');
        assert(reply.text == 'hello', 'dialog responded with incorrect message');
        assert(client.dialogTurnResult.status == DialogTurnStatus.empty, 'dialog did not end properly');

    });


    it('should process a 2 turn waterfall dialog', async function() {

        let dialog = new WaterfallDialog('waterfall', [
            async(step) => {
                await step.context.sendActivity('hello');
                return step.next();
            },
            async(step) => {
                await step.context.sendActivity('hello 2');
                return step.endDialog();
            },
        ]);

        let client = new DialogTestClient(dialog);
        let reply = await client.sendActivity('hello');
        assert(reply.text == 'hello', 'dialog responded with incorrect message');
        reply = await client.getNextReply();
        assert(reply.text == 'hello 2', 'dialog responded with incorrect 2nd message');
        assert(client.dialogTurnResult.status == DialogTurnStatus.empty, 'dialog did not end properly');
    });


    it('should process a component dialog', async function() {

        class MainDialog extends ComponentDialog {
            constructor(id) {
                super(id);

                let dialog = new WaterfallDialog('waterfall', [
                    async(step) => {
                        return step.prompt('textPrompt', 'Tell me something');
                    },
                    async(step) => {
                        await step.context.sendActivity('you said: ' + step.result);
                        return step.next();
                    },
                ]);
        
                this.addDialog(dialog);
                this.addDialog(new TextPrompt('textPrompt'));
            }

            async run(turnContext, accessor) {
                const dialogSet = new DialogSet(accessor);
                dialogSet.add(this);
        
                const dialogContext = await dialogSet.createContext(turnContext);
                const results = await dialogContext.continueDialog();
                if (results.status === DialogTurnStatus.empty) {
                    await dialogContext.beginDialog(this.id);
                }
            }
        }


        let component = new MainDialog('component');

        let client = new DialogTestClient(component);
        let reply = await client.sendActivity('hello');
        assert(reply.text == 'Tell me something','dialog responded with incorrect message');
        reply = await client.sendActivity('foo');
        assert(reply.text == 'you said: foo', 'dialog responded with incorrect 2nd message');
        assert(client.dialogTurnResult.status == DialogTurnStatus.complete, 'dialog did not end properly');
    });

});