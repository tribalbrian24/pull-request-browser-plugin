import { ARM_ATTR, CLIPBOARD_EVENT, HOOK_ATTR, PASS_ATTR } from './clipboard';

const armed = () => document.documentElement.hasAttribute(ARM_ATTR);
const passthrough = () => document.documentElement.hasAttribute(PASS_ATTR);
const emit = (text: unknown) => {
  if (armed() && text != null) document.dispatchEvent(new CustomEvent(CLIPBOARD_EVENT, { detail: String(text) }));
};

function selectedText(): string {
  const field = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  if (field && typeof field.selectionStart === 'number' && typeof field.value === 'string' && field.selectionEnd! > field.selectionStart) {
    return field.value.slice(field.selectionStart, field.selectionEnd!);
  }
  return String(getSelection() ?? '');
}

async function emitPlainText(items: ClipboardItem[]) {
  try {
    for (const item of items) {
      if (item.types.includes('text/plain')) {
        emit(await (await item.getType('text/plain')).text());
        return;
      }
    }
  } catch {
    /* reporting must never break the page's own copy */
  }
}

/**
 * Runs in the page's own JS context. While a capture is armed it reports whatever the page tries to copy (writeText,
 * write, a copy event's setData, execCommand) and, unless passthrough is set, swallows the write so the user's clipboard
 * is never touched and the browser never prompts. When not armed, everything passes through unchanged.
 */
export function installClipboardHook() {
  document.documentElement.setAttribute(HOOK_ATTR, '1');
  const clip: Partial<Pick<Clipboard, 'writeText' | 'write'>> | undefined = navigator.clipboard;

  if (clip?.writeText) {
    const original = clip.writeText.bind(clip);
    clip.writeText = text => {
      if (!armed()) return original(text);
      emit(text);
      return passthrough() ? original(text) : Promise.resolve();
    };
  }

  if (clip?.write) {
    const original = clip.write.bind(clip);
    clip.write = async items => {
      if (!armed()) return original(items);
      await emitPlainText(items);
      return passthrough() ? original(items) : undefined;
    };
  }

  if (typeof DataTransfer !== 'undefined') {
    const setData = DataTransfer.prototype.setData;
    DataTransfer.prototype.setData = function (format: string, data: string) {
      if (format === 'text/plain' || format === 'text') emit(data);
      return setData.call(this, format, data);
    };
  }

  if (typeof document.execCommand === 'function') {
    const exec = document.execCommand.bind(document);
    document.execCommand = (command: string, showUi?: boolean, value?: string) => {
      if (command !== 'copy' && command !== 'cut') return exec(command, showUi, value);
      if (!armed()) return exec(command, showUi, value);
      emit(selectedText());
      return passthrough() ? exec(command, showUi, value) : true;
    };
  }
}
