import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

for (const width of [1440, 860]) {
  test(`P71 footer and short-first layout ${width}`, async ({ page }, info) => {
    await page.setViewportSize({width,height:900});
    await page.clock.install({time:new Date(FIXTURE_NOW).getTime()});
    await installTauriMock(page,createPublicFixture(),"main");
    await page.goto("/");
    await page.locator(".nextStepRow").first().click({button:"right"});
    await page.getByRole("menuitem",{name:"編集",exact:true}).click();
    const editor=page.getByRole("dialog",{name:"プロジェクト編集",exact:true});
    await expect(editor.locator(".dialogActions > button")).toHaveText(["保存","キャンセル"]);
    await expect(editor.locator(".projectTimerSetting > span")).toHaveText(["短時間タイマー","通常タイマー"]);
    const short=editor.getByRole("spinbutton",{name:"プロジェクトの短時間タイマー分数"});
    const normal=editor.getByRole("spinbutton",{name:"プロジェクトの通常タイマー分数"});
    await short.scrollIntoViewIfNeeded();
    const a=await short.boundingBox(),b=await normal.boundingBox();
    expect(a && b && (width <= 900 ? a.y < b.y : a.x < b.x)).toBeTruthy();
    await editor.screenshot({path:info.outputPath("timer-order.png")});
    await editor.getByRole("button",{name:"開始環境を選ぶ",exact:true}).click();
    const picker=page.getByRole("dialog",{name:"開始環境を選ぶ",exact:true});
    await expect(picker.locator(".dialogActions > button")).toHaveText(["選択を反映","キャンセル"]);
    await expect(picker.getByRole("button",{name:"キャンセル",exact:true})).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await picker.screenshot({path:info.outputPath("picker-focus.png")});
    await picker.getByRole("button",{name:"キャンセル",exact:true}).click();
    await expect(picker).toHaveCount(0);
    await editor.getByRole("button",{name:"キャンセル",exact:true}).click();
    await page.getByRole("button",{name:"やりたいことを追加",exact:true}).click();
    const wishlist=page.getByRole("dialog");
    await expect(wishlist.locator(".dialogActions > button")).toHaveText(["保存","キャンセル"]);
    await wishlist.screenshot({path:info.outputPath("wishlist-footer.png")});
  });
}
