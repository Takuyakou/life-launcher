use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[cfg(windows)]
std::thread_local! {
    static MAIN_SHELL_DROP_TARGETS: std::cell::RefCell<Vec<(
        isize,
        windows::Win32::System::Ole::IDropTarget,
    )>> = const { std::cell::RefCell::new(Vec::new()) };
    static MAIN_SHELL_DROP_OLE_INITIALIZED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

#[cfg(windows)]
unsafe fn has_shell_id_list(data: &windows::Win32::System::Com::IDataObject) -> bool {
    use std::ptr;

    use windows::Win32::System::Com::{DVASPECT_CONTENT, FORMATETC, TYMED_HGLOBAL};
    use windows::Win32::System::DataExchange::RegisterClipboardFormatW;
    use windows::Win32::UI::Shell::CFSTR_SHELLIDLIST;

    let format_id = RegisterClipboardFormatW(CFSTR_SHELLIDLIST);
    if format_id == 0 {
        return false;
    }
    let format = FORMATETC {
        cfFormat: format_id as u16,
        ptd: ptr::null_mut(),
        dwAspect: DVASPECT_CONTENT.0,
        lindex: -1,
        tymed: TYMED_HGLOBAL.0 as u32,
    };
    data.QueryGetData(&format).is_ok()
}

#[cfg(windows)]
unsafe fn is_recycle_bin_data_object(data: &windows::Win32::System::Com::IDataObject) -> bool {
    use windows::Win32::UI::Shell::{
        FOLDERID_RecycleBinFolder, ILFree, ILIsEqual, IShellItem, SHGetIDListFromObject,
        SHGetItemFromDataObject, SHGetKnownFolderIDList, DATAOBJ_GET_ITEM_FLAGS, DOGIF_NO_HDROP,
        DOGIF_NO_URL, DOGIF_ONLY_IF_ONE,
    };

    let flags: DATAOBJ_GET_ITEM_FLAGS = DOGIF_NO_HDROP | DOGIF_NO_URL | DOGIF_ONLY_IF_ONE;
    let Ok(shell_item): windows::core::Result<IShellItem> = SHGetItemFromDataObject(data, flags)
    else {
        return false;
    };
    SHGetIDListFromObject(&shell_item)
        .ok()
        .and_then(|dropped_pidl| {
            let matched = SHGetKnownFolderIDList(&FOLDERID_RecycleBinFolder, 0, None)
                .ok()
                .map(|recycle_pidl| {
                    let result = ILIsEqual(dropped_pidl, recycle_pidl).as_bool();
                    ILFree(Some(recycle_pidl));
                    result
                });
            ILFree(Some(dropped_pidl));
            matched
        })
        .unwrap_or(false)
}

#[cfg(windows)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DropKind {
    None,
    Paths,
    Url,
    ShellCandidate,
    RecycleBin,
}

#[cfg(windows)]
impl DropKind {
    fn effect(
        self,
        allowed: windows::Win32::System::Ole::DROPEFFECT,
    ) -> windows::Win32::System::Ole::DROPEFFECT {
        use windows::Win32::System::Ole::{
            DROPEFFECT_COPY, DROPEFFECT_LINK, DROPEFFECT_MOVE, DROPEFFECT_NONE,
        };

        let preferences = match self {
            Self::None => return DROPEFFECT_NONE,
            Self::Paths => [DROPEFFECT_COPY, DROPEFFECT_LINK, DROPEFFECT_MOVE],
            Self::Url => [DROPEFFECT_LINK, DROPEFFECT_COPY, DROPEFFECT_MOVE],
            Self::ShellCandidate | Self::RecycleBin => {
                [DROPEFFECT_LINK, DROPEFFECT_COPY, DROPEFFECT_MOVE]
            }
        };
        preferences
            .into_iter()
            .find(|effect| allowed.0 & effect.0 != 0)
            .unwrap_or(DROPEFFECT_NONE)
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MainShellDropEvent {
    pub window_label: String,
    pub stage: String,
    pub paths: Vec<String>,
    pub url: Option<String>,
    pub label: Option<String>,
    pub shell_special: Option<String>,
    pub message: String,
}

fn emit_event(app: &AppHandle, event: MainShellDropEvent) {
    let _ = app.emit("main-shell-drop-result", event);
}

fn first_http_url(text: &str) -> Option<String> {
    text.lines()
        .map(|line| line.trim_matches(['\0', '\u{feff}', ' ', '\t', '\r']))
        .find(|line| {
            let lowercase = line.to_ascii_lowercase();
            !line.is_empty()
                && !line.starts_with('#')
                && (lowercase.starts_with("https://") || lowercase.starts_with("http://"))
        })
        .map(str::to_string)
}

fn decode_utf16_drop_text(bytes: &[u8]) -> Option<String> {
    let code_units = bytes
        .chunks_exact(2)
        .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
        .take_while(|value| *value != 0)
        .collect::<Vec<_>>();
    String::from_utf16(&code_units).ok()
}

fn decode_byte_drop_text(bytes: &[u8]) -> Option<String> {
    let content = bytes.split(|byte| *byte == 0).next().unwrap_or_default();
    (!content.is_empty()).then(|| String::from_utf8_lossy(content).into_owned())
}

#[derive(Debug, PartialEq, Eq)]
struct DroppedUrl {
    url: String,
    label: Option<String>,
}

fn dropped_url_from_text(text: &str, has_label_line: bool) -> Option<DroppedUrl> {
    let lines = text
        .lines()
        .map(|line| line.trim_matches(['\0', '\u{feff}', ' ', '\t', '\r']))
        .collect::<Vec<_>>();
    let url_index = lines
        .iter()
        .position(|line| first_http_url(line).is_some())?;
    let url = first_http_url(lines[url_index])?;
    let label = has_label_line
        .then(|| {
            lines
                .iter()
                .skip(url_index + 1)
                .find(|line| !line.is_empty() && !line.starts_with('#'))
                .map(|line| (*line).to_string())
        })
        .flatten()
        .filter(|label| label != &url);

    Some(DroppedUrl { url, label })
}

fn bookmark_label_from_virtual_filename(filename: &str) -> Option<String> {
    let filename = filename.trim_matches(['\0', ' ', '\t', '\r', '\n']);
    let label = filename
        .len()
        .checked_sub(4)
        .and_then(|extension_start| {
            filename
                .get(extension_start..)
                .filter(|extension| extension.eq_ignore_ascii_case(".url"))
                .and_then(|_| filename.get(..extension_start))
        })
        .unwrap_or(filename)
        .trim();
    (!label.is_empty()).then(|| label.to_string())
}

#[tauri::command]
pub fn enable_main_shell_drop(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let registration_app = app.clone();
    let source_label = window.label().to_string();
    app.run_on_main_thread(move || {
        if let Err(error) = install_main_shell_drop_target(&registration_app) {
            emit_event(
                &registration_app,
                MainShellDropEvent {
                    window_label: source_label,
                    stage: "error".to_string(),
                    paths: Vec::new(),
                    url: None,
                    label: None,
                    shell_special: None,
                    message: error,
                },
            );
        }
    })
    .map_err(|error| error.to_string())
}

fn install_main_shell_drop_target(app: &AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        install_windows_target(app)
    }

    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(())
    }
}

pub fn remove_main_shell_drop_target(_app: &AppHandle) {
    #[cfg(windows)]
    {
        use std::ffi::c_void;

        use windows::Win32::Foundation::HWND;
        use windows::Win32::System::Ole::RevokeDragDrop;

        let registrations = MAIN_SHELL_DROP_TARGETS.with_borrow_mut(std::mem::take);
        for (handle, _target) in registrations {
            let _ = unsafe { RevokeDragDrop(HWND(handle as *mut c_void)) };
        }
        MAIN_SHELL_DROP_OLE_INITIALIZED.with(|initialized| {
            if initialized.replace(false) {
                unsafe { windows::Win32::System::Ole::OleUninitialize() };
            }
        });
    }

    #[cfg(not(windows))]
    {
        let _ = _app;
    }
}

#[cfg(windows)]
fn install_windows_target(app: &AppHandle) -> Result<(), String> {
    use std::ffi::c_void;

    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Ole::{OleInitialize, OleUninitialize, RevokeDragDrop};

    // RegisterDragDrop requires COM/OLE to be initialized on the UI thread.
    // Ready is emitted on that thread once WebView2 child windows exist.
    let already_initialized = MAIN_SHELL_DROP_OLE_INITIALIZED.get();
    if !already_initialized {
        unsafe { OleInitialize(None).map_err(|error| error.to_string())? };
        MAIN_SHELL_DROP_OLE_INITIALIZED.set(true);
    }
    let registrations = MAIN_SHELL_DROP_TARGETS.with_borrow_mut(std::mem::take);
    for (handle, _target) in registrations {
        let _ = unsafe { RevokeDragDrop(HWND(handle as *mut c_void)) };
    }
    let result = install_windows_target_inner(app);
    if result.is_err() && !already_initialized {
        MAIN_SHELL_DROP_OLE_INITIALIZED.set(false);
        unsafe { OleUninitialize() };
    }
    result
}

#[cfg(windows)]
fn install_windows_target_inner(app: &AppHandle) -> Result<(), String> {
    use std::cell::Cell;
    use std::ffi::{c_void, OsString};
    use std::os::windows::ffi::OsStringExt;
    use std::ptr;

    use windows::core::{implement, BOOL};
    use windows::Win32::Foundation::{DRAGDROP_E_INVALIDHWND, HWND, LPARAM, POINTL};
    use windows::Win32::System::Com::{
        IDataObject, DVASPECT_CONTENT, FORMATETC, TYMED_HGLOBAL, TYMED_ISTREAM,
    };
    use windows::Win32::System::Ole::{
        IDropTarget, IDropTarget_Impl, RegisterDragDrop, RevokeDragDrop, CF_HDROP, DROPEFFECT,
        DROPEFFECT_NONE,
    };
    use windows::Win32::System::SystemServices::MODIFIERKEYS_FLAGS;
    use windows::Win32::UI::Shell::{DragFinish, DragQueryFileW, HDROP};
    use windows::Win32::UI::WindowsAndMessaging::EnumChildWindows;

    #[implement(IDropTarget)]
    struct MainShellDropTarget {
        app: AppHandle,
        window_label: String,
        active_kind: Cell<DropKind>,
        active_effect: Cell<DROPEFFECT>,
    }

    impl MainShellDropTarget {
        fn new(app: AppHandle, window_label: String) -> Self {
            Self {
                app,
                window_label,
                active_kind: Cell::new(DropKind::None),
                active_effect: Cell::new(DROPEFFECT_NONE),
            }
        }
    }

    impl IDropTarget_Impl for MainShellDropTarget_Impl {
        fn DragEnter(
            &self,
            data: windows_core::Ref<'_, IDataObject>,
            _key_state: MODIFIERKEYS_FLAGS,
            _point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let (mut kind, paths, url, label) =
                unsafe { classify_drop(data.as_ref().expect("Received null IDataObject")) };
            if kind == DropKind::None
                && unsafe { has_shell_id_list(data.as_ref().expect("Received null IDataObject")) }
            {
                kind = DropKind::ShellCandidate;
            }
            let selected_effect = unsafe { kind.effect(*effect) };
            self.active_kind.set(kind);
            self.active_effect.set(selected_effect);
            unsafe {
                *effect = selected_effect;
            }
            if kind != DropKind::None {
                emit_event(
                    &self.app,
                    MainShellDropEvent {
                        window_label: self.window_label.clone(),
                        stage: "dragEnter".to_string(),
                        paths,
                        url,
                        label,
                        shell_special: (kind == DropKind::RecycleBin)
                            .then(|| "recycle_bin".to_string()),
                        message: "登録できる項目を受信しています".to_string(),
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
                *effect = self.active_effect.get();
            }
            Ok(())
        }

        fn DragLeave(&self) -> windows::core::Result<()> {
            self.active_effect.set(DROPEFFECT_NONE);
            if self.active_kind.replace(DropKind::None) != DropKind::None {
                emit_event(
                    &self.app,
                    MainShellDropEvent {
                        window_label: self.window_label.clone(),
                        stage: "dragLeave".to_string(),
                        paths: Vec::new(),
                        url: None,
                        label: None,
                        shell_special: None,
                        message: "Dropをキャンセルしました".to_string(),
                    },
                );
            }
            Ok(())
        }

        fn Drop(
            &self,
            data: windows_core::Ref<'_, IDataObject>,
            _key_state: MODIFIERKEYS_FLAGS,
            _point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let (kind, paths, url, label) =
                unsafe { classify_drop(data.as_ref().expect("Received null IDataObject")) };
            let selected_effect = unsafe { kind.effect(*effect) };
            self.active_kind.set(DropKind::None);
            self.active_effect.set(DROPEFFECT_NONE);
            unsafe {
                *effect = selected_effect;
            }
            if kind != DropKind::None {
                emit_event(
                    &self.app,
                    MainShellDropEvent {
                        window_label: self.window_label.clone(),
                        stage: "drop".to_string(),
                        paths,
                        url,
                        label,
                        shell_special: (kind == DropKind::RecycleBin)
                            .then(|| "recycle_bin".to_string()),
                        message: if kind == DropKind::RecycleBin {
                            "ごみ箱を識別しました。登録内容を確認してください".to_string()
                        } else {
                            "項目を識別しました。登録内容を確認してください".to_string()
                        },
                    },
                );
            }
            Ok(())
        }
    }

    unsafe fn classify_drop(
        data: &IDataObject,
    ) -> (DropKind, Vec<String>, Option<String>, Option<String>) {
        let paths = extract_paths(data);
        if !paths.is_empty() {
            return (DropKind::Paths, paths, None, None);
        }

        if let Some(dropped) = extract_url(data) {
            return (DropKind::Url, Vec::new(), Some(dropped.url), dropped.label);
        }

        if is_recycle_bin_data_object(data) {
            (DropKind::RecycleBin, Vec::new(), None, None)
        } else {
            (DropKind::None, Vec::new(), None, None)
        }
    }

    unsafe fn extract_url(data: &IDataObject) -> Option<DroppedUrl> {
        use windows::Win32::System::DataExchange::RegisterClipboardFormatW;
        use windows::Win32::System::Ole::{CF_TEXT, CF_UNICODETEXT};
        use windows::Win32::UI::Shell::{CFSTR_INETURLA, CFSTR_INETURLW};

        let virtual_file_label = extract_virtual_url_label(data);
        let moz_format = RegisterClipboardFormatW(windows_core::w!("text/x-moz-url")) as u16;
        if moz_format != 0 {
            if let Some(text) =
                read_data_bytes(data, moz_format).and_then(|bytes| decode_utf16_drop_text(&bytes))
            {
                if let Some(mut dropped) = dropped_url_from_text(&text, true) {
                    dropped.label = dropped.label.or_else(|| virtual_file_label.clone());
                    return Some(dropped);
                }
            }
        }

        let registered_formats = [
            (RegisterClipboardFormatW(CFSTR_INETURLW) as u16, true),
            (RegisterClipboardFormatW(CFSTR_INETURLA) as u16, false),
            (
                RegisterClipboardFormatW(windows_core::w!("text/uri-list")) as u16,
                false,
            ),
        ];

        for (format_id, utf16) in registered_formats {
            if format_id == 0 {
                continue;
            }
            let Some(bytes) = read_data_bytes(data, format_id) else {
                continue;
            };
            let text = if utf16 {
                decode_utf16_drop_text(&bytes)
            } else {
                decode_byte_drop_text(&bytes)
            };
            if let Some(mut dropped) = text.and_then(|value| dropped_url_from_text(&value, false)) {
                dropped.label = virtual_file_label.clone();
                return Some(dropped);
            }
        }

        for (format_id, utf16) in [(CF_UNICODETEXT.0, true), (CF_TEXT.0, false)] {
            let Some(bytes) = read_data_bytes(data, format_id) else {
                continue;
            };
            let text = if utf16 {
                decode_utf16_drop_text(&bytes)
            } else {
                decode_byte_drop_text(&bytes)
            };
            if let Some(mut dropped) = text.and_then(|value| dropped_url_from_text(&value, false)) {
                dropped.label = virtual_file_label.clone();
                return Some(dropped);
            }
        }

        None
    }

    unsafe fn extract_virtual_url_label(data: &IDataObject) -> Option<String> {
        use std::mem;

        use windows::Win32::System::DataExchange::RegisterClipboardFormatW;
        use windows::Win32::UI::Shell::{CFSTR_FILEDESCRIPTORW, FILEGROUPDESCRIPTORW};

        let format_id = RegisterClipboardFormatW(CFSTR_FILEDESCRIPTORW) as u16;
        if format_id == 0 {
            return None;
        }
        let bytes = read_data_bytes(data, format_id)?;
        if bytes.len() < mem::size_of::<FILEGROUPDESCRIPTORW>() {
            return None;
        }
        let group = std::ptr::read_unaligned(bytes.as_ptr().cast::<FILEGROUPDESCRIPTORW>());
        if group.cItems == 0 {
            return None;
        }
        let descriptor = group.fgd[0];
        let filename_units = descriptor.cFileName;
        let filename_end = filename_units
            .iter()
            .position(|unit| *unit == 0)
            .unwrap_or(filename_units.len());
        let filename = String::from_utf16_lossy(&filename_units[..filename_end]);
        bookmark_label_from_virtual_filename(&filename)
    }

    unsafe fn read_data_bytes(data: &IDataObject, format_id: u16) -> Option<Vec<u8>> {
        use std::slice;

        use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};
        use windows::Win32::System::Ole::ReleaseStgMedium;
        use windows::Win32::UI::Shell::{IStream_Read, IStream_Reset, IStream_Size};

        let format = FORMATETC {
            cfFormat: format_id,
            ptd: ptr::null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: (TYMED_HGLOBAL.0 | TYMED_ISTREAM.0) as u32,
        };
        let mut medium = data.GetData(&format).ok()?;
        let bytes = if medium.tymed == TYMED_HGLOBAL.0 as u32 {
            let hglobal = medium.u.hGlobal;
            let size = GlobalSize(hglobal);
            let pointer = GlobalLock(hglobal);
            let bytes = if pointer.is_null() || size == 0 {
                None
            } else {
                Some(slice::from_raw_parts(pointer.cast::<u8>(), size).to_vec())
            };
            if !pointer.is_null() {
                let _ = GlobalUnlock(hglobal);
            }
            bytes
        } else if medium.tymed == TYMED_ISTREAM.0 as u32 {
            medium.u.pstm.as_ref().cloned().and_then(|stream| {
                let size = IStream_Size(&stream).ok()?;
                if size == 0 || size > 1024 * 1024 {
                    return None;
                }
                IStream_Reset(&stream).ok()?;
                let mut bytes = vec![0; size as usize];
                IStream_Read(&stream, bytes.as_mut_ptr().cast(), size as u32).ok()?;
                Some(bytes)
            })
        } else {
            None
        };
        ReleaseStgMedium(&mut medium);
        bytes
    }

    unsafe fn extract_paths(data: &IDataObject) -> Vec<String> {
        let format = FORMATETC {
            cfFormat: CF_HDROP.0,
            ptd: ptr::null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: TYMED_HGLOBAL.0 as u32,
        };
        let Ok(medium) = data.GetData(&format) else {
            return Vec::new();
        };
        let hdrop = HDROP(medium.u.hGlobal.0 as _);
        let item_count = DragQueryFileW(hdrop, 0xFFFF_FFFF, None);
        let mut paths = Vec::with_capacity(item_count as usize);
        for index in 0..item_count {
            let length = DragQueryFileW(hdrop, index, None) as usize;
            let mut buffer = vec![0; length + 1];
            DragQueryFileW(hdrop, index, Some(&mut buffer));
            paths.push(
                OsString::from_wide(&buffer[..length])
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        DragFinish(hdrop);
        paths
    }

    let mut registrations = Vec::new();
    unsafe extern "system" fn enumerate_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let callback = &mut *(lparam.0 as *mut c_void as *mut &mut dyn FnMut(HWND) -> bool);
        callback(hwnd).into()
    }

    for window_label in ["main", "dictionary"] {
        let Some(window) = app.get_webview_window(window_label) else {
            continue;
        };
        let parent = window.hwnd().map_err(|error| error.to_string())?;
        let app_handle = app.clone();
        let label = window_label.to_string();
        let mut callback = |hwnd: HWND| {
            let target: IDropTarget =
                MainShellDropTarget::new(app_handle.clone(), label.clone()).into();
            if unsafe { RevokeDragDrop(hwnd) } != Err(DRAGDROP_E_INVALIDHWND.into())
                && unsafe { RegisterDragDrop(hwnd, &target) }.is_ok()
            {
                registrations.push((hwnd.0 as isize, target));
            }
            true
        };
        let mut callback_ref: &mut dyn FnMut(HWND) -> bool = &mut callback;
        let callback_pointer: *mut c_void = unsafe { std::mem::transmute(&mut callback_ref) };
        let lparam = LPARAM(callback_pointer as isize);
        unsafe {
            let _ = EnumChildWindows(Some(parent), Some(enumerate_callback), lparam);
        }
    }

    if registrations.is_empty() {
        return Err("WebView2のDrop Targetを登録できませんでした".to_string());
    }
    MAIN_SHELL_DROP_TARGETS.with_borrow_mut(|items| *items = registrations);
    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::{
        bookmark_label_from_virtual_filename, decode_byte_drop_text, decode_utf16_drop_text,
        dropped_url_from_text, first_http_url, has_shell_id_list, is_recycle_bin_data_object,
        DropKind, DroppedUrl,
    };
    use windows::Win32::System::Com::{IBindCtx, IDataObject};
    use windows::Win32::System::Ole::{
        OleInitialize, OleUninitialize, DROPEFFECT_COPY, DROPEFFECT_LINK,
    };
    use windows::Win32::UI::Shell::{
        BHID_DataObject, FOLDERID_RecycleBinFolder, ILFree, IShellItem, SHCreateItemFromIDList,
        SHGetKnownFolderIDList,
    };

    #[test]
    fn parses_first_http_url_from_uri_list() {
        let text = "# browser bookmark\r\nHTTPS://example.com/path\r\nhttps://ignored.example";

        assert_eq!(
            first_http_url(text).as_deref(),
            Some("HTTPS://example.com/path")
        );
    }

    #[test]
    fn decodes_url_clipboard_text_formats() {
        let utf16 = "https://example.com/ja\0"
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();
        let bytes = b"https://example.com/plain\0ignored";

        assert_eq!(
            decode_utf16_drop_text(&utf16).as_deref(),
            Some("https://example.com/ja")
        );
        assert_eq!(
            decode_byte_drop_text(bytes).as_deref(),
            Some("https://example.com/plain")
        );
    }

    #[test]
    fn reads_bookmark_title_from_moz_url_format() {
        assert_eq!(
            dropped_url_from_text("https://example.com/path\r\nMy saved bookmark", true),
            Some(DroppedUrl {
                url: "https://example.com/path".to_string(),
                label: Some("My saved bookmark".to_string()),
            })
        );
        assert_eq!(
            dropped_url_from_text("https://example.com/path\r\nMy saved bookmark", false),
            Some(DroppedUrl {
                url: "https://example.com/path".to_string(),
                label: None,
            })
        );
    }

    #[test]
    fn reads_bookmark_title_from_virtual_url_filename() {
        assert_eq!(
            bookmark_label_from_virtual_filename("Life Launcher 開発.url").as_deref(),
            Some("Life Launcher 開発")
        );
        assert_eq!(
            bookmark_label_from_virtual_filename("Reference.URL").as_deref(),
            Some("Reference")
        );
    }

    #[test]
    fn recognizes_real_recycle_bin_shell_data_object() -> windows::core::Result<()> {
        unsafe { OleInitialize(None)? };
        let result = (|| unsafe {
            let pidl = SHGetKnownFolderIDList(&FOLDERID_RecycleBinFolder, 0, None)?;
            let shell_item: IShellItem = SHCreateItemFromIDList(pidl)?;
            ILFree(Some(pidl));
            let data: IDataObject =
                shell_item.BindToHandler(None::<&IBindCtx>, &BHID_DataObject)?;
            Ok::<_, windows::core::Error>((
                has_shell_id_list(&data),
                is_recycle_bin_data_object(&data),
            ))
        })();
        unsafe { OleUninitialize() };

        let (has_shell_format, is_recycle_bin) = result?;
        assert!(
            has_shell_format,
            "Recycle Bin must expose CFSTR_SHELLIDLIST"
        );
        assert!(is_recycle_bin, "Recycle Bin IDataObject must be identified");
        Ok(())
    }

    #[test]
    fn shell_cursor_prefers_link_while_paths_prefer_copy() {
        assert_eq!(
            DropKind::ShellCandidate.effect(DROPEFFECT_COPY | DROPEFFECT_LINK),
            DROPEFFECT_LINK
        );
        assert_eq!(
            DropKind::Url.effect(DROPEFFECT_COPY | DROPEFFECT_LINK),
            DROPEFFECT_LINK
        );
        assert_eq!(DropKind::Paths.effect(DROPEFFECT_COPY), DROPEFFECT_COPY);
    }
}
