import { expect, test, type Page } from "@playwright/test";
import { canonicalSourceKey, resnapshotSource, timerSourceKey } from "../../src/sourceEdit";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

function seed() {
  const f = createPublicFixture();
  const p = f.config.projects[0];
  f.config.inbox = [{id:"p71-w1",text:"同じ文"},{id:"p71-w2",text:"同じ文"}];
  f.config.today.items = [
    {sourceKey:`project:${p.id}`,projectId:p.id,text:p.nextStep,done:false,shortTimerMinutes:3,defaultTimerMinutes:25},
    {sourceKey:"wishlist:p71-w1",text:"同じ文",done:true,shortTimerMinutes:5,defaultTimerMinutes:25},
  ];
  return f;
}
async function prepare(page: Page) {
  await page.clock.install({time:new Date(FIXTURE_NOW).getTime()});
  await installTauriMock(page,seed(),"main");
  await page.goto("/");
  await expect(page.locator(".todayRow")).toHaveCount(2);
}
async function current(page: Page) {
  return page.evaluate(() => (window as Window & {__LIFE_LAUNCHER_VISUAL_QA__: {currentConfig:()=>AppConfig}}).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
}
async function edit(page: Page,index=0) {
  await page.locator(".todayRow").nth(index).click({button:"right"});
  await page.getByRole("menuitem",{name:"編集",exact:true}).click();
}

test("P71 matrix preserves identity/history and clears removed snapshot fields",()=>{
  const before=seed().config;
  const p=before.projects[0];
  const key=`project:${p.id}`;
  const updated=structuredClone(before);
  Object.assign(updated.projects[0],{nextStep:"更新",nextStepTrigger:"合図",buttonIds:["sample-documents"],shortTimerMinutes:2,defaultTimerMinutes:40});
  const first=resnapshotSource(before,updated,key);
  expect(first.today.items[0]).toMatchObject({text:"更新",trigger:"合図",shortTimerMinutes:2,defaultTimerMinutes:40,buttonIds:["sample-documents"],sourceKey:key,done:false});
  expect(first.today.items[0].instructionPath).toBe(p.instructionPath);
  const next=structuredClone(first);
  delete next.projects[0].instructionPath;
  delete next.projects[0].nextStepTrigger;
  next.projects[0].buttonIds=[];
  const result=resnapshotSource(first,next,key);
  expect(result.today.items[0].instructionPath).toBeUndefined();
  expect(result.today.items[0].instructionOpenOnStart).toBeUndefined();
  expect(result.today.items[0].trigger).toBeUndefined();
  expect(result.today.items[0].buttonIds).toBeUndefined();
  expect(result.today.items[1]).toEqual(before.today.items[1]);
  expect(result.sourceCompletions).toEqual(before.sourceCompletions);
  expect(result.today.date).toBe(before.today.date);
  expect(timerSourceKey(before,p.id)).toBe(key);
  expect(timerSourceKey(before,`today:${key}`)).toBe(key);
  expect(canonicalSourceKey(before,"wishlist:none:同じ文")).toBeNull();
  expect(canonicalSourceKey(before,"legacy:unknown")).toBeNull();
  const legacy=structuredClone(before);
  legacy.inbox=legacy.inbox.slice(0,1);
  legacy.today.items[1].sourceKey="wishlist:none:同じ文";
  expect(()=>resnapshotSource(legacy,legacy,"wishlist:p71-w1")).toThrow("旧形式");
});

test("P71 Wishlist identity, relink, done and no-linked case",()=>{
  const before=seed().config;
  const next=structuredClone(before);
  next.inbox[0]={...next.inbox[0],text:"新しい文",projectId:next.projects[0].id};
  next.projects[0].shortTimerMinutes=2;
  const result=resnapshotSource(before,next,"wishlist:p71-w1");
  expect(result.today.items[1]).toMatchObject({text:"新しい文",done:true,sourceKey:"wishlist:p71-w1",shortTimerMinutes:2,projectId:next.projects[0].id});
  expect(result.inbox[1]).toEqual(before.inbox[1]);
  expect(resnapshotSource(before,next,"wishlist:p71-w2")).toBe(next);
  const duplicate=structuredClone(before);
  duplicate.today.items.push({...duplicate.today.items[0]});
  expect(()=>resnapshotSource(duplicate,duplicate,duplicate.today.items[0].sourceKey!)).toThrow();
});

test("P71 Today Project editor saves both in one call; failure retains draft",async({page})=>{
  await prepare(page);
  const before=await current(page);
  await edit(page);
  const dialog=page.getByRole("dialog",{name:"プロジェクト編集",exact:true});
  await dialog.getByRole("textbox",{name:/^次の一手/}).fill("同期した次の一手");
  await page.evaluate(()=>{
    (window as Window & {__LIFE_LAUNCHER_VISUAL_QA__: {setSaveConfigFailure:(v:boolean)=>void}}).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true);
  });
  await dialog.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.locator(".toast").last()).toContainText("保存できません");
  await expect(dialog).toBeVisible();
  expect((await current(page)).today).toEqual(before.today);
  await page.evaluate(()=>{
    (window as Window & {__LIFE_LAUNCHER_VISUAL_QA__: {setSaveConfigFailure:(v:boolean)=>void}}).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(false);
  });
  await dialog.getByRole("button",{name:"保存",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect((await current(page)).today.items[0].text).toBe("同期した次の一手");
  expect((await current(page)).projects[0].nextStep).toBe("同期した次の一手");
  await page.reload();
  expect((await current(page)).today.items[0].text).toBe("同期した次の一手");
});

test("P71 running/paused blocks Today and source edit, other source stays editable",async({page})=>{
  await prepare(page);
  const card=page.locator(".todayRow").first();
  await card.getByRole("button",{name:"通常タイマー25分で開始"}).click();
  for(const paused of [false,true]) {
    if(paused) await card.getByRole("button",{name:"このセッションを一時停止",exact:true}).click();
    await card.click({button:"right"});
    await expect(page.getByRole("menuitem",{name:"編集",exact:true})).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.locator(".nextStepRow").first().click({button:"right"});
    const editButton=page.getByRole("menuitem",{name:"編集",exact:true});
    await expect(editButton).toBeDisabled();
    await editButton.evaluate(node=>{
      const props=Object.keys(node).find(key=>key.startsWith("__reactProps$"));
      if(!props) throw new Error("React props unavailable");
      (node as unknown as Record<string,{onClick:()=>void}>)[props].onClick();
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await edit(page,1);
  await expect(page.getByRole("dialog",{name:"やりたいこと編集"})).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"キャンセル",exact:true}).click();
  await card.getByRole("button",{name:"終了",exact:true}).click();
  await edit(page);
  await expect(page.getByRole("dialog",{name:"プロジェクト編集",exact:true})).toBeVisible();
});

test("P71 source editor changes the next early threshold without changing history",async({page})=>{
  await prepare(page);
  await page.locator(".nextStepRow").first().click({button:"right"});
  await page.getByRole("menuitem",{name:"編集",exact:true}).click();
  const editor=page.getByRole("dialog",{name:"プロジェクト編集",exact:true});
  await editor.getByRole("spinbutton",{name:"プロジェクトの短時間タイマー分数"}).fill("2");
  await editor.getByRole("button",{name:"保存",exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect((await current(page)).today.items[0].shortTimerMinutes).toBe(2);
  const card=page.locator(".todayRow").first();
  await card.getByRole("button",{name:"通常タイマー25分で開始"}).click();
  await page.clock.fastForward(120_000);
  await card.getByRole("button",{name:"終了",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"今日の分は完了にしますか？"})).toBeVisible();
});

test("P71 Today Wishlist editing and source-side editing share the same snapshot",async({page})=>{
  await prepare(page);
  await edit(page,1);
  const editor=page.getByRole("dialog",{name:"やりたいこと編集"});
  await editor.getByRole("textbox").first().fill("Wishlist更新");
  await editor.getByRole("button",{name:"保存",exact:true}).click();
  await expect(editor).toHaveCount(0);
  const config=await current(page);
  expect(config.inbox[0].text).toBe("Wishlist更新");
  expect(config.inbox[1].text).toBe("同じ文");
  expect(config.today.items[1]).toMatchObject({text:"Wishlist更新",done:true,sourceKey:"wishlist:p71-w1"});
  await page.locator(".inboxRow").first().click({button:"right"});
  await page.getByRole("menuitem",{name:"編集",exact:true}).click();
  await editor.getByRole("textbox").first().fill("元から更新");
  await editor.getByRole("button",{name:"保存",exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect((await current(page)).today.items[1].text).toBe("元から更新");
});

test("P71 direct save is rejected if the same timer starts after editor opens",async({page})=>{
  await prepare(page);
  await edit(page);
  const editor=page.getByRole("dialog",{name:"プロジェクト編集",exact:true});
  await editor.getByRole("textbox",{name:/^次の一手/}).fill("保存してはいけない");
  await page.locator(".todayRow").first().getByRole("button",{name:"通常タイマー25分で開始"}).evaluate(node=>{
    const props=Object.keys(node).find(k=>k.startsWith("__reactProps$"));
    if(!props) throw new Error("React props unavailable");
    (node as unknown as Record<string,{onClick:()=>void}>)[props].onClick();
  });
  await editor.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.locator(".toast").last()).toContainText("タイマーを停止してから編集してください");
  await expect(editor).toBeVisible();
  expect((await current(page)).projects[0].nextStep).toBe(seed().config.projects[0].nextStep);
});
