use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellDropPocEvent {
    pub stage: String,
    pub message: String,
    pub formats: Vec<String>,
    pub display_name: Option<String>,
    pub parsing_name: Option<String>,
    pub is_recycle_bin: Option<bool>,
    pub shell_special: Option<String>,
}

fn emit_event(app: &AppHandle, event: ShellDropPocEvent) {
    let _ = app.emit("shell-drop-poc-result", event);
}

#[tauri::command]
pub fn start_shell_drop_poc(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    {
        let mut slot = state
            .shell_drop_poc_hwnd
            .lock()
            .map_err(|_| "failed to lock shell drop PoC state".to_string())?;
        if slot.is_some() {
            return Err("Shell D&D PoCは既に起動しています".to_string());
        }
        *slot = Some(0);
    }

    let thread_app = app.clone();
    std::thread::spawn(move || {
        #[cfg(windows)]
        let result = run_native_shell_drop_poc(thread_app.clone());
        #[cfg(not(windows))]
        let result: Result<(), String> =
            Err("Shell D&D PoCはWindowsでのみ利用できます".to_string());

        if let Err(error) = result {
            emit_event(
                &thread_app,
                ShellDropPocEvent {
                    stage: "error".to_string(),
                    message: error,
                    formats: Vec::new(),
                    display_name: None,
                    parsing_name: None,
                    is_recycle_bin: None,
                    shell_special: None,
                },
            );
        }

        if let Ok(mut slot) = thread_app.state::<AppState>().shell_drop_poc_hwnd.lock() {
            *slot = None;
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_shell_drop_poc(app: AppHandle) -> Result<(), String> {
    stop_shell_drop_poc_internal(&app)
}

pub fn stop_shell_drop_poc_internal(app: &AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ffi::c_void;
        use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
        use windows::Win32::UI::WindowsAndMessaging::{PostMessageW, WM_CLOSE};

        let hwnd = app
            .state::<AppState>()
            .shell_drop_poc_hwnd
            .lock()
            .map_err(|_| "failed to lock shell drop PoC state".to_string())?
            .unwrap_or_default();
        if hwnd == 0 {
            return Ok(());
        }

        unsafe {
            PostMessageW(
                Some(HWND(hwnd as *mut c_void)),
                WM_CLOSE,
                WPARAM(0),
                LPARAM(0),
            )
            .map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Shell D&D PoCはWindowsでのみ利用できます".to_string())
    }
}

#[cfg(windows)]
fn run_native_shell_drop_poc(app: AppHandle) -> Result<(), String> {
    use windows::Win32::System::Ole::{OleInitialize, OleUninitialize};

    unsafe {
        OleInitialize(None).map_err(|error| error.to_string())?;
        let result = run_native_shell_drop_poc_inner(app);
        OleUninitialize();
        result
    }
}

#[cfg(windows)]
fn run_native_shell_drop_poc_inner(app: AppHandle) -> Result<(), String> {
    use std::ffi::c_void;

    use windows::core::{implement, PCWSTR};
    use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, POINTL, WPARAM};
    use windows::Win32::Graphics::Gdi::HBRUSH;
    use windows::Win32::System::Com::{CoTaskMemFree, IDataObject, DATADIR_GET, FORMATETC};
    use windows::Win32::System::DataExchange::{GetClipboardFormatNameW, RegisterClipboardFormatW};
    use windows::Win32::System::Ole::{
        IDropTarget, IDropTarget_Impl, RegisterDragDrop, RevokeDragDrop, DROPEFFECT,
        DROPEFFECT_COPY,
    };
    use windows::Win32::System::SystemServices::MODIFIERKEYS_FLAGS;
    use windows::Win32::UI::Shell::{
        FOLDERID_RecycleBinFolder, ILFree, ILIsEqual, IShellItem, SHGetIDListFromObject,
        SHGetItemFromDataObject, SHGetKnownFolderIDList, CFSTR_SHELLIDLIST, DATAOBJ_GET_ITEM_FLAGS,
        DOGIF_NO_HDROP, DOGIF_NO_URL, DOGIF_ONLY_IF_ONE, SIGDN_DESKTOPABSOLUTEPARSING,
        SIGDN_NORMALDISPLAY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW, LoadCursorW,
        PostQuitMessage, RegisterClassExW, TranslateMessage, CS_HREDRAW, CS_VREDRAW, CW_USEDEFAULT,
        HCURSOR, HICON, IDC_ARROW, MSG, WM_CLOSE, WM_DESTROY, WNDCLASSEXW, WS_OVERLAPPEDWINDOW,
        WS_VISIBLE,
    };

    const CLASS_NAME: PCWSTR = windows::core::w!("LifeLauncherV11TauriShellDropPoc");
    const WINDOW_TITLE: PCWSTR = windows::core::w!("Life Launcher - Shell D&D 統合PoC");

    #[derive(Clone)]
    struct DropInspection {
        formats: Vec<String>,
        display_name: Option<String>,
        parsing_name: Option<String>,
        is_recycle_bin: Option<bool>,
    }

    #[implement(IDropTarget)]
    struct ShellDropTarget {
        app: AppHandle,
    }

    impl IDropTarget_Impl for ShellDropTarget_Impl {
        fn DragEnter(
            &self,
            data: windows_core::Ref<'_, IDataObject>,
            _key_state: MODIFIERKEYS_FLAGS,
            _point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            unsafe {
                *effect = DROPEFFECT_COPY;
                let formats = collect_formats(data.as_ref().expect("Received null IDataObject"));
                emit_event(
                    &self.app,
                    ShellDropPocEvent {
                        stage: "dragEnter".to_string(),
                        message: "Shell項目を受信しています".to_string(),
                        formats,
                        display_name: None,
                        parsing_name: None,
                        is_recycle_bin: None,
                        shell_special: None,
                    },
                );
            }
            Ok(())
        }

        fn DragOver(
            &self,
            _key_state: MODIFIERKEYS_FLAGS,
            _point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            unsafe {
                *effect = DROPEFFECT_COPY;
            }
            Ok(())
        }

        fn DragLeave(&self) -> windows::core::Result<()> {
            emit_event(
                &self.app,
                ShellDropPocEvent {
                    stage: "dragLeave".to_string(),
                    message: "Dropをキャンセルしました".to_string(),
                    formats: Vec::new(),
                    display_name: None,
                    parsing_name: None,
                    is_recycle_bin: None,
                    shell_special: None,
                },
            );
            Ok(())
        }

        fn Drop(
            &self,
            data: windows_core::Ref<'_, IDataObject>,
            _key_state: MODIFIERKEYS_FLAGS,
            _point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            unsafe {
                *effect = DROPEFFECT_COPY;
                let inspection = inspect_drop(data.as_ref().expect("Received null IDataObject"));
                let message = match inspection.is_recycle_bin {
                    Some(true) => "ごみ箱を識別しました。登録内容を確認してください".to_string(),
                    Some(false) => "Shell項目を受信しましたが、ごみ箱ではありません".to_string(),
                    None => "Shell項目の識別に失敗しました".to_string(),
                };
                emit_event(
                    &self.app,
                    ShellDropPocEvent {
                        stage: "drop".to_string(),
                        message,
                        formats: inspection.formats,
                        display_name: inspection.display_name,
                        parsing_name: inspection.parsing_name,
                        is_recycle_bin: inspection.is_recycle_bin,
                        shell_special: inspection
                            .is_recycle_bin
                            .filter(|matched| *matched)
                            .map(|_| "recycle_bin".to_string()),
                    },
                );
            }
            Ok(())
        }
    }

    unsafe fn collect_formats(data: &IDataObject) -> Vec<String> {
        let mut formats = Vec::new();
        if let Ok(enumerator) = data.EnumFormatEtc(DATADIR_GET.0 as u32) {
            loop {
                let mut format = FORMATETC::default();
                let mut fetched = 0;
                let result = enumerator.Next(std::slice::from_mut(&mut format), Some(&mut fetched));
                if result.is_err() || fetched == 0 {
                    break;
                }
                formats.push(format_name(format.cfFormat as u32));
            }
        }
        formats
    }

    unsafe fn inspect_drop(data: &IDataObject) -> DropInspection {
        let formats = collect_formats(data);
        let flags: DATAOBJ_GET_ITEM_FLAGS = DOGIF_NO_HDROP | DOGIF_NO_URL | DOGIF_ONLY_IF_ONE;
        let shell_item: IShellItem = match SHGetItemFromDataObject(data, flags) {
            Ok(item) => item,
            Err(_) => {
                return DropInspection {
                    formats,
                    display_name: None,
                    parsing_name: None,
                    is_recycle_bin: None,
                };
            }
        };

        let display_name = shell_item
            .GetDisplayName(SIGDN_NORMALDISPLAY)
            .ok()
            .map(|value| take_task_string(value.0));
        let parsing_name = shell_item
            .GetDisplayName(SIGDN_DESKTOPABSOLUTEPARSING)
            .ok()
            .map(|value| take_task_string(value.0));
        let is_recycle_bin = SHGetIDListFromObject(&shell_item)
            .ok()
            .and_then(|dropped_pidl| {
                let result = SHGetKnownFolderIDList(&FOLDERID_RecycleBinFolder, 0, None)
                    .ok()
                    .map(|recycle_pidl| {
                        let matched = ILIsEqual(dropped_pidl, recycle_pidl).as_bool();
                        ILFree(Some(recycle_pidl));
                        matched
                    });
                ILFree(Some(dropped_pidl));
                result
            });

        DropInspection {
            formats,
            display_name,
            parsing_name,
            is_recycle_bin,
        }
    }

    unsafe fn take_task_string(pointer: *mut u16) -> String {
        if pointer.is_null() {
            return String::new();
        }
        let mut length = 0;
        while *pointer.add(length) != 0 {
            length += 1;
        }
        let value = String::from_utf16_lossy(std::slice::from_raw_parts(pointer, length));
        CoTaskMemFree(Some(pointer.cast::<c_void>()));
        value
    }

    unsafe fn format_name(format: u32) -> String {
        if format == 15 {
            return "CF_HDROP".to_string();
        }
        let shell_id_list_format = RegisterClipboardFormatW(CFSTR_SHELLIDLIST);
        if format == shell_id_list_format {
            return "Shell IDList Array".to_string();
        }
        let mut buffer = [0u16; 256];
        let length = GetClipboardFormatNameW(format, &mut buffer);
        if length > 0 {
            String::from_utf16_lossy(&buffer[..length as usize])
        } else {
            format!("clipboard:{format}")
        }
    }

    unsafe extern "system" fn window_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match message {
            WM_CLOSE => {
                PostQuitMessage(0);
                LRESULT(0)
            }
            WM_DESTROY => LRESULT(0),
            _ => DefWindowProcW(hwnd, message, wparam, lparam),
        }
    }

    fn create_window() -> Result<HWND, String> {
        unsafe {
            let cursor: HCURSOR =
                LoadCursorW(None, IDC_ARROW).map_err(|error| error.to_string())?;
            let window_class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                style: CS_HREDRAW | CS_VREDRAW,
                lpfnWndProc: Some(window_proc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: HINSTANCE::default(),
                hIcon: HICON::default(),
                hCursor: cursor,
                hbrBackground: HBRUSH::default(),
                lpszMenuName: PCWSTR::null(),
                lpszClassName: CLASS_NAME,
                hIconSm: HICON::default(),
            };
            let _ = RegisterClassExW(&window_class);
            CreateWindowExW(
                Default::default(),
                CLASS_NAME,
                WINDOW_TITLE,
                WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                620,
                260,
                None,
                None,
                None,
                None,
            )
            .map_err(|error| error.to_string())
        }
    }

    fn set_hwnd(app: &AppHandle, hwnd: Option<isize>) {
        if let Ok(mut slot) = app.state::<AppState>().shell_drop_poc_hwnd.lock() {
            *slot = hwnd;
        }
    }

    fn run_native_loop(app: AppHandle) -> Result<(), String> {
        unsafe {
            let hwnd = create_window()?;
            set_hwnd(&app, Some(hwnd.0 as isize));
            let target: IDropTarget = ShellDropTarget { app: app.clone() }.into();
            if let Err(error) = RegisterDragDrop(hwnd, &target) {
                let _ = DestroyWindow(hwnd);
                set_hwnd(&app, None);
                return Err(error.to_string());
            }

            emit_event(
                &app,
                ShellDropPocEvent {
                    stage: "ready".to_string(),
                    message: "専用Shell D&Dテスト領域を開きました".to_string(),
                    formats: Vec::new(),
                    display_name: None,
                    parsing_name: None,
                    is_recycle_bin: None,
                    shell_special: None,
                },
            );

            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }

            let revoke_result = RevokeDragDrop(hwnd).map_err(|error| error.to_string());
            let _ = DestroyWindow(hwnd);
            set_hwnd(&app, None);
            emit_event(
                &app,
                ShellDropPocEvent {
                    stage: "closed".to_string(),
                    message: "専用Shell D&Dテスト領域を閉じました".to_string(),
                    formats: Vec::new(),
                    display_name: None,
                    parsing_name: None,
                    is_recycle_bin: None,
                    shell_special: None,
                },
            );
            revoke_result
        }
    }

    run_native_loop(app)
}
