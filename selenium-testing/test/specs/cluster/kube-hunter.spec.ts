import { login } from '../../functions/login.js';
import { buildUrl } from '../../functions/build-url.js';
import { sleep } from '../../functions/sleep.js';
import { exec } from '../../functions/exec.js';
import config from '../../config.js';
import { Key } from 'webdriverio';
import { cleanCommand } from '../../functions/clean-command.js';

/**
 * Ensure that the Kube Hunter page is functional and that KubeHunter audits work properly
 */
describe('KubeHunter Page::', () => {
    // Login to m9sweeper and navigate to the KubeHunter page
    it('1 Login and navigate to page', async () => {
        // Login to m9sweeper
        await login();
        expect(browser).toHaveUrl(
            buildUrl('private/dashboard/group/1'),
            {message: "m9sweeper should have logged in and loaded the default dashboard"}
        );

        // Open the default cluster
        // @ts-ignore
        await $("//mat-card-title[contains(text(),'default-cluster')]").customClick("load-default-cluster");
        expect(browser).toHaveUrl(
            buildUrl('private/clusters/1/summary'),
            {message: "m9sweeper should be displaying the cluster summary for the default cluster"}
        );

        // Move to the KubeHunter page
        // @ts-ignore
        await $("//span[@class='menu-item-name'][contains(text(), 'kube-hunter')]").customClick("kubehunter-page");
        expect(browser).toHaveUrl(
            buildUrl('private/clusters/1/kubehunter'),
            {message: "m9sweeper should be displaying the KubeHunter page"}
        );

        // Take a screenshot at the end so that we can see the results
        // @ts-ignore
        await browser.customScreenshot("test-end");
    });


    // Run a one time only kube-hunter scan to ensure that it is working right
    it('2 Run a one-time KubeHunter scan', async () => {
        // Locate and click the Run Audit button
        // @ts-ignore
        await $("//mat-card-content//button[contains(normalize-space(), 'Run Audit')]").customClick('run-audit');
        expect(await $("//div[contains(@class, 'cdk-overlay-container')]//app-kube-hunter-dialog")).toBePresent(
            {message: "Kube Hunter Run configuration window should be visible"}
        );

        // Locate and select the Run one time option
        // @ts-ignore
        await $("//div[contains(@class, 'cdk-overlay-container')]//label[contains(normalize-space(), 'Run one time')]").customClick("choose-run-one-time");
        expect(await $("//div[contains(@class, 'cdk-overlay-container')]//label[contains(normalize-space(), 'Run one time')]/parent::div/parent::mat-radio-button")).toHaveElementClassContaining(
            "mat-mdc-radio-checked",
            {message: "The Run on time radio button should be selected"}
        );

        // Locate the text area containing the helm cli command to use to run the audit
        let helmCommandText = (await (await $("//div[contains(@class, 'cdk-overlay-container')]//textarea")).getText()).trim();

        // Capture a screenshot so that we can see the command that was copied for troubleshooting if needed
        // @ts-ignore
        await browser.customScreenshot('helm-command');

        // Locate the next button and make sure it goes to the next page
        // @ts-ignore
        await $("//div[contains(@class, 'cdk-overlay-container')]//button/span[contains(text(),'Next')]").customClick('next');
        expect(await $("//div[contains(@class, 'cdk-overlay-container')]//h3[contains(normalize-space(), 'After running the CLI command')]")).toBePresent(
            {message: "The screen displaying the information about viewing the report should be visible."}
        );

        // Close the popup dialog by pressing the escape key
        await browser.keys(Key.Escape);
        expect(await $("//div[contains(@class, 'cdk-overlay-container')]//app-kube-hunter-dialog")).not.toBePresent(
            {message: "Kube Hunter Run configuration window should not be visible"}
        );

        // Wait for 3 seconds to ensure log output is clear for the commands
        await sleep(3000);

        // Reformat the command into a single line of text with no \ line separators so that the shell can parse it properly
        helmCommandText = cleanCommand(helmCommandText);

        // Add the custom docker registry URL if one is supplied via environment variables
        if ((config.DOCKER_REGISTRY?.trim()?.length || 0) > 0) {
            helmCommandText = helmCommandText + ` --set-string image.repository='${config.DOCKER_REGISTRY}/aquasec/kube-hunter'`;
        }

        // Execute the commands to run the kube-hunter pod and generate a report
        const exitCode = await exec(`${helmCommandText} --debug`);
        expect(exitCode).toEqual(0);

        // Wait 15 seconds for m9sweeper to load the report from kube-hunter
        await sleep(15000);

        // Reload the page we are currently on so that we can get an updated test status
        await browser.refresh();

        // Wait 5 seconds to let the page finish loading after the refresh
        await sleep(5000);

        // Verify that we have a result in the table
        expect(await $(`//table//tr[contains(normalize-space(), '${(new Date()).getFullYear()}')]`)).toBePresent(
            {message: "A Kube Hunter result should be present"}
        );

        // Take a screenshot at the end so that we can see the results
        // @ts-ignore
        await browser.customScreenshot("test-end");
    });


    // TODO
    // Verify we can view the report page itself
    // it('3 Verify report page', async () => {
    // });
});