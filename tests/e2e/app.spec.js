import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
test('keyword lecture preserves complete bullets and skips contextless demographics', async({page})=>{
  test.skip(!process.env.MEDIMATE_SAMPLE_PDF, 'Optional local user-provided regression PDF');
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button',{name:'Transes',exact:true}).click();
  await page.getByLabel('Import PDF',{exact:true}).setInputFiles(process.env.MEDIMATE_SAMPLE_PDF);
  await expect(page.getByText('7 / 7 pages attempted',{exact:true})).toBeVisible({timeout:45000});
  await page.getByRole('button',{name:'Create source-recall drafts',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Review',exact:true}).click();
  await expect(page.getByRole('heading',{name:/morphology.*Neisseria and Moraxella cattarhalis/i})).toBeVisible();
  await expect(page.getByRole('heading',{name:'What is ● Males?',exact:true})).toHaveCount(0);
  const article=page.locator('article').filter({has:page.getByRole('heading',{name:/morphology.*Neisseria and Moraxella cattarhalis/i})});
  await article.getByRole('button',{name:'Review / edit',exact:true}).click();
  await expect(page.getByLabel('Answer',{exact:true})).toHaveValue(/sides flattened.*coffee bean/);
  await expect(page.getByRole('link',{name:'Open original PDF · page 1'})).toBeVisible();
  const priorQuestion=await page.getByLabel('Question',{exact:true}).inputValue();
  await page.getByRole('button',{name:'Save draft & next',exact:true}).click();
  await expect(page.getByLabel('Question',{exact:true})).not.toHaveValue(priorQuestion);
  await page.getByRole('button',{name:'Skip',exact:true}).click();
});
const go = async (page, name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
test("PDF → verified study → backup → offline; desktop and mobile layouts", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, Sheanienne." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Go to section')).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await go(page,'Quizzes');
  await expect(page.getByRole('heading',{name:'Build your first practice question.'})).toBeVisible();
  await page.screenshot({path:'test-results/quiz-empty-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await page.screenshot({path:'test-results/quiz-empty-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Add a question in Review',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your next practice session'})).toBeVisible();
  await page.setViewportSize({width:1280,height:900});
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf
    .addPage([500, 700])
    .drawText("Test term: An illustrative definition for testing.", {
      x: 30,
      y: 650,
      size: 14,
      font,
    });
  pdf.addPage([500, 700]);
  const bytes = await pdf.save();
  await go(page, "Transes");
  await page
    .getByLabel("Import PDF", { exact: true })
    .setInputFiles({
      name: "Fixture.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
  await expect(
    page.getByText("2 / 2 pages attempted", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 extracted · 1 flagged · 0 pending", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create source-recall drafts", exact: true })
    .click();
  await page.getByRole('button',{name:'Create drafts from all pages',exact:true}).click();
  await expect(page.getByText(/0 drafts added to Review · 1 existing items preserved/)).toBeVisible();
  await page.getByRole('button',{name:'Next page',exact:true}).click();
  await expect(page.getByLabel('Jump to page')).toHaveValue('2');
  await page.getByRole('button',{name:'Previous page',exact:true}).click();
  await page.getByRole('button',{name:'Rename / move PDF',exact:true}).click();
  await page.getByLabel('PDF name',{exact:true}).fill('Fixture renamed.pdf');
  await page.getByRole('button',{name:'Save PDF details',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Fixture renamed.pdf',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/library-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await page.screenshot({path:'test-results/library-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await go(page, "Review");
  await page.getByLabel('Search study items').fill('no matching question');
  await expect(page.getByRole('heading',{name:'No matching study items'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  const approveAll = page.getByRole("button", { name: "Approve all drafts (1)", exact: true });
  page.once("dialog", dialog => dialog.dismiss());
  await approveAll.click();
  await expect(approveAll).toBeEnabled();
  page.once("dialog", dialog => dialog.accept());
  await approveAll.click();
  await expect(page.getByText("1 draft approved. Ready to study.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve all drafts (0)", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "All items", exact: true }).click();
  await page.screenshot({path:'test-results/review-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await page.screenshot({path:'test-results/review-mobile.png',fullPage:true});
  await page.getByLabel('Go to section').selectOption('Quizzes');
  await expect(page.getByRole('heading',{name:'Quizzes',exact:true})).toBeVisible();
  await page.getByLabel('Go to section').selectOption('Review');
  await page.setViewportSize({width:820,height:1000});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',820);
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole('button',{name:'All items',exact:true}).click();
  await page
    .getByRole("button", { name: "Review / edit", exact: true })
    .click();
  await expect(page.getByLabel("Answer", { exact: true })).toHaveValue(
    "An illustrative definition for testing.",
  );
  await page.getByLabel('Question',{exact:true}).fill('An unsaved change');
  page.once('dialog',dialog=>dialog.dismiss());
  await go(page,'Today');
  await expect(page.getByLabel('Question',{exact:true})).toHaveValue('An unsaved change');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Review / edit',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Compare with the source'})).toBeVisible();
  await expect(page.getByLabel('Original PDF page 1',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/review-editor-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await page.screenshot({path:'test-results/review-editor-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await expect(page.getByText('Item 1 of 1 in this list')).toBeVisible();
  await expect(page.getByText('Excerpt found on page 1 and highlighted in the extracted text.')).toBeVisible();
  await expect(page.locator('.source-text mark')).toHaveText('Test term: An illustrative definition for testing.');
  await page.getByLabel('Also accept these typed answers (optional, one per line)').fill('Illustrative definition');
  await page
    .getByRole("button", { name: "Verify & next", exact: true })
    .click();
  await page.getByRole('button',{name:'Open quizzes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your flashcards are ready to use.'})).toBeVisible();
  await page.getByRole('button',{name:'Use verified flashcards',exact:true}).click();
  await expect(page.getByText('This session: 1 question',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Start quiz',exact:true}).click();
  await expect(page.getByLabel('Your answer',{exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'End session',exact:true}).click();
  await go(page,'Moving exam');
  await page.getByRole('button',{name:'Use verified flashcards',exact:true}).click();
  await page.getByLabel('Seconds per station').fill('');
  await expect(page.getByRole('button',{name:'Start moving exam',exact:true})).toBeDisabled();
  await expect(page.getByText('Choose a whole number of seconds from 10 to 600.')).toBeVisible();
  await page.getByLabel('Seconds per station').fill('60');
  await expect(page.getByRole('button',{name:'Start moving exam',exact:true})).toBeEnabled();
  await go(page, "Flashcards");
  await page.getByRole("button", { name: "Begin flashcards" }).click();
  await page
    .getByRole("button", { name: "Reveal answer", exact: true })
    .click();
  await page.getByRole("button", { name: "Remembered", exact: true }).click();
  await expect(
    page.getByText("1 / 1 remembered. Your review schedule is saved."),
  ).toBeVisible();
  await go(page, "Review");
  await page.getByRole("button", { name: "All items", exact: true }).click();
  await page.getByRole('button',{name:'Copy to quiz bank',exact:true}).click();
  await page.getByLabel('Item type',{exact:true}).selectOption('question');
  await expect(page.locator('.review-list article')).toHaveCount(1);
  await go(page, "Quizzes");
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  await page.getByLabel("Your answer", { exact: true }).fill("An unrelated answer");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.locator(".result-score")).toHaveText("0 / 1");
  await expect(page.getByText("Don't be down, Sheanienne.", { exact: false })).toBeVisible();
  await page.screenshot({path:'test-results/quiz-result-desktop.png',fullPage:true});
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  await page.getByLabel("Your answer", { exact: true }).fill("definition");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.locator(".result-score")).toHaveText("0 / 1");
  await page.getByRole("button", { name: "Accept my answer from now on", exact: true }).click();
  await expect(page.getByText(/Added\. Future sessions will accept “definition”/)).toBeVisible();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  await page.getByLabel("Your answer", { exact: true }).fill("Definition.");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.locator(".result-score")).toHaveText("1 / 1");
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("  illustrative DEFINITION. ");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible();
  await expect(page.locator(".result-score")).toHaveText("1 / 1");
  await expect(page.getByText("Counted through your accepted answer “Illustrative definition”.")).toBeVisible();
  await expect(page.getByText("A perfect score, Sheanienne! You should be so proud of yourself.")).toBeVisible();
  await go(page, "Moving exam");
  await page.getByLabel("Seconds per station").fill("10");
  await page
    .getByRole("button", { name: "Start moving exam", exact: true })
    .click();
  await page.reload();
  await go(page, "Moving exam");
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".result-score")).toHaveText("0 / 1");
  await go(page, "Settings");
  await page.getByLabel("Preferred name").fill("Test Student");
  await page.getByRole("button", { name: "Save personalization" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs("test-results/backup.json");
  await page
    .getByLabel("Import backup", { exact: true })
    .setInputFiles("test-results/backup.json");
  await expect(
    page.getByRole("heading", { name: "Review this import" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Merge, keep local conflicts" })
    .click();
  await expect(
    page.getByText("Backup merged. Existing local conflicts were kept."),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hello, Test Student." }),
  ).toBeVisible();
  await go(page, "Transes");
  await page.getByRole("button", { name: /Fixture renamed.pdf/ }).click();
  await expect(
    page.getByText("2 / 2 pages attempted", { exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
