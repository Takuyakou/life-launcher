import type { KeyboardEvent } from "react";
import { UiIcon } from "./UiIcon";
import { useEffect, useRef, useState } from "react";
import {
  HELP_GUIDE_LEAD,
  HELP_GUIDE_SECTIONS,
  type HelpGuideBlock,
  type HelpSectionId,
} from "../content/helpGuide";

type HelpGuideDialogProps = {
  onClose: () => void;
  onCopyResult: (ok: boolean) => void;
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HelpBlock({
  block,
  copyingId,
  onCopy,
}: {
  block: HelpGuideBlock;
  copyingId: string | null;
  onCopy: (id: string, content: string) => void;
}) {
  if (block.type === "paragraph") {
    return <p>{block.text}</p>;
  }

  if (block.type === "steps") {
    return (
      <ol className="helpGuideSteps">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "bullets") {
    return (
      <ul className="helpGuideBullets">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "definitions") {
    return (
      <dl className="helpGuideDefinitions">
        {block.items.map((item) => (
          <div key={item.term}>
            <dt>{item.term}</dt>
            <dd>{item.description}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (block.type === "note") {
    return <aside className={`helpGuideNote helpGuideNote--${block.tone}`}>{block.text}</aside>;
  }

  if (block.type === "code") {
    return (
      <figure className="helpGuideCodeBlock">
        <figcaption>
          <span>{block.label}</span>
          {block.copyable && (
            <button
              aria-label={`${block.label}をコピー`}
              className="secondaryButton helpGuideCopyButton"
              disabled={copyingId !== null}
              onClick={() => onCopy(block.id, block.content)}
              type="button"
            >
              {copyingId === block.id ? "コピー中" : "コピー"}
            </button>
          )}
        </figcaption>
        <pre tabIndex={0}>
          <code>{block.content}</code>
        </pre>
      </figure>
    );
  }

  return (
    <div className="helpGuideExamples">
      {block.items.map((item) => (
        <article key={item.title}>
          <h4>{item.title}</h4>
          <dl>
            <div>
              <dt>曖昧</dt>
              <dd>{item.bad}</dd>
            </div>
            <div>
              <dt>次の一手</dt>
              <dd>{item.good}</dd>
            </div>
            {item.short && (
              <div>
                <dt>短時間</dt>
                <dd>{item.short}</dd>
              </div>
            )}
          </dl>
          {item.note && <p>{item.note}</p>}
        </article>
      ))}
    </div>
  );
}

export function HelpGuideDialog({ onClose, onCopyResult }: HelpGuideDialogProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstTocButtonRef = useRef<HTMLButtonElement>(null);
  const navigationTargetRef = useRef<HelpSectionId | null>(null);
  const navigationReleaseTimerRef = useRef<number | null>(null);
  const openerRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [activeSectionId, setActiveSectionId] = useState<HelpSectionId>(HELP_GUIDE_SECTIONS[0].id);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(() => !window.matchMedia("(max-width: 760px)").matches);

  useEffect(() => {
    const opener = openerRef.current;
    titleRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const updateForViewport = () => setTocOpen(!media.matches);
    media.addEventListener("change", updateForViewport);
    return () => media.removeEventListener("change", updateForViewport);
  }, []);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      () => {
        if (navigationTargetRef.current) {
          setActiveSectionId(navigationTargetRef.current);
          return;
        }

        const sections = HELP_GUIDE_SECTIONS.map((section) => ({
          element: root.querySelector<HTMLElement>(`[data-help-section-id="${section.id}"]`),
          id: section.id,
        }));
        const rootRect = root.getBoundingClientRect();
        const activationLine = rootRect.top + Math.min(72, root.clientHeight * 0.2);
        let currentId = HELP_GUIDE_SECTIONS[0].id;

        for (const section of sections) {
          if (!section.element || section.element.getBoundingClientRect().top > activationLine) break;
          currentId = section.id;
        }

        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
          currentId = HELP_GUIDE_SECTIONS[HELP_GUIDE_SECTIONS.length - 1].id;
        }
        setActiveSectionId(currentId);
      },
      { root, rootMargin: "0px 0px -68% 0px", threshold: [0, 0.1, 0.5] },
    );

    HELP_GUIDE_SECTIONS.forEach((section) => {
      const element = root.querySelector(`[data-help-section-id="${section.id}"]`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (navigationReleaseTimerRef.current !== null) {
        window.clearTimeout(navigationReleaseTimerRef.current);
      }
    },
    [],
  );

  const jumpTo = (id: HelpSectionId) => {
    const section = bodyRef.current?.querySelector<HTMLElement>(`#help-${id}`);
    const heading = section?.querySelector<HTMLHeadingElement>("h3");
    if (!section || !heading) return;
    const reducedMotion = prefersReducedMotion();
    if (navigationReleaseTimerRef.current !== null) {
      window.clearTimeout(navigationReleaseTimerRef.current);
    }
    navigationTargetRef.current = id;
    setActiveSectionId(id);
    heading.focus({ preventScroll: true });
    section.scrollIntoView({
      block: "start",
      behavior: reducedMotion ? "auto" : "smooth",
    });
    navigationReleaseTimerRef.current = window.setTimeout(
      () => {
        navigationTargetRef.current = null;
        navigationReleaseTimerRef.current = null;
      },
      reducedMotion ? 0 : 900,
    );
    if (window.matchMedia("(max-width: 760px)").matches) setTocOpen(false);
  };

  const returnToContents = () => {
    setTocOpen(true);
    bodyRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    window.requestAnimationFrame(() => firstTocButtonRef.current?.focus());
  };

  const copyBlock = async (id: string, content: string) => {
    if (copyingId !== null) return;
    setCopyingId(id);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard API is not available");
      await navigator.clipboard.writeText(content);
      onCopyResult(true);
    } catch {
      onCopyResult(false);
    } finally {
      setCopyingId(null);
    }
  };

  const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex="0"]',
      ),
    );
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === titleRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modalBackdrop helpGuideBackdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="help-guide-title"
        aria-modal="true"
        className="dropDialog helpGuideDialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={keepFocusInside}
        role="dialog"
      >
        <header className="helpGuideHeader">
          <div>
            <p className="eyebrow">Guide</p>
            <h2 id="help-guide-title" ref={titleRef} tabIndex={-1}>
              使い方
            </h2>
          </div>
          <button
            aria-label="使い方を閉じる"
            className="confirmDialogClose"
            onClick={onClose}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </header>

        <button
          aria-controls="help-guide-toc"
          aria-expanded={tocOpen}
          className="secondaryButton helpGuideTocToggle"
          onClick={() => setTocOpen((open) => !open)}
          type="button"
        >
          {tocOpen ? "目次を閉じる" : "目次を開く"}
        </button>

        <div className="helpGuideLayout">
          <nav
            aria-label="使い方の目次"
            className={`helpGuideNav${tocOpen ? "" : " helpGuideNav--closed"}`}
            id="help-guide-toc"
          >
            {HELP_GUIDE_SECTIONS.map((section, index) => {
              const active = section.id === activeSectionId;
              return (
                <button
                  aria-current={active ? "location" : undefined}
                  key={section.id}
                  onClick={() => jumpTo(section.id)}
                  ref={index === 0 ? firstTocButtonRef : undefined}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{section.title}</strong>
                  {active && <span className="helpGuideNavCurrent">表示中</span>}
                </button>
              );
            })}
          </nav>

          <div className="helpGuideBody app-scrollbar" ref={bodyRef} tabIndex={-1}>
            <aside className="helpGuideLead">{HELP_GUIDE_LEAD}</aside>
            {HELP_GUIDE_SECTIONS.map((section, index) => (
              <section
                className="helpGuideSection"
                data-help-section-id={section.id}
                id={`help-${section.id}`}
                key={section.id}
              >
                <p className="helpGuideSectionNumber">{String(index + 1).padStart(2, "0")}</p>
                <h3 tabIndex={-1}>{section.title}</h3>
                <p className="helpGuideSummary">{section.summary}</p>
                {section.blocks.map((block, blockIndex) => (
                  <HelpBlock
                    block={block}
                    copyingId={copyingId}
                    key={`${section.id}-${block.type}-${blockIndex}`}
                    onCopy={copyBlock}
                  />
                ))}
                <button className="helpGuideBackToToc" onClick={returnToContents} type="button">
                  目次へ戻る
                </button>
              </section>
            ))}
          </div>
        </div>

        <footer className="helpGuideFooter">
          <span>このガイドはオフラインで読めます。ChatGPTへの自動送信はありません。</span>
          <button className="secondaryButton" onClick={onClose} type="button">
            閉じる
          </button>
        </footer>
      </section>
    </div>
  );
}
