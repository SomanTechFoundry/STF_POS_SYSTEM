import { useEffect, useRef, useState } from "react";

function normalizeHoverItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (typeof item === "string") return { label: item, value: "" };
    return {
      label: item?.label || "",
      value: item?.value === undefined || item?.value === null ? "" : String(item.value)
    };
  }).filter((item) => item.label || item.value);
}

function normalizeSections(sections) {
  return (Array.isArray(sections) ? sections : [])
    .map((section) => ({
      title: section?.title || "",
      layout: section?.layout || "list",
      items: normalizeHoverItems(section?.items || [])
    }))
    .filter((section) => section.title || section.items.length > 0);
}

function StatCard({ title, value, hint, extra, hoverTitle, hoverItems = [], hoverSections = [], hoverMaxItems = 8 }) {
  const hasHoverItems = Array.isArray(hoverItems) && hoverItems.length > 0;
  const normalizedSections = normalizeSections(hoverSections);
  const hasHoverSections = normalizedSections.length > 0;
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const wrapRef = useRef(null);
  const normalizedItems = normalizeHoverItems(hoverItems);
  const visibleItems = normalizedItems.slice(0, hoverMaxItems);
  const hiddenCount = Math.max(0, normalizedItems.length - visibleItems.length);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <article className="stat-card">
        <p className="stat-title">{title}</p>
        {(hasHoverItems || hasHoverSections) ? (
          <div ref={wrapRef} className={`stat-hover-wrap${isOpen ? " open" : ""}`}>
            <button
              type="button"
              className="stat-hover-trigger"
              aria-label={hoverTitle || "Details"}
              aria-expanded={isOpen}
              onClick={() => setIsOpen((prev) => !prev)}
            >
              i
            </button>
            <div className="stat-hover-pane">
              {hoverTitle ? <p className="stat-hover-title">{hoverTitle}</p> : null}
              {hasHoverSections ? (
                <div className="stat-hover-list">
                  {normalizedSections.map((section) => (
                    <div key={section.title} className="stat-hover-section">
                      {section.title ? <p className="stat-hover-section-title">{section.title}</p> : null}
                      {section.layout === "pair" ? (
                        <div className="stat-hover-pair-grid">
                          {section.items.map((item) => (
                            <div key={`${section.title}-${item.label}-${item.value}`} className="stat-hover-pair-cell">
                              <span className="stat-hover-pair-label">{item.label}</span>
                              {item.value ? <span className="stat-hover-pair-value">{item.value}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        section.items.map((item) => (
                          <div key={`${section.title}-${item.label}-${item.value}`} className="stat-hover-item-row">
                            <span className="stat-hover-item-label">{item.label}</span>
                            {item.value ? <span className="stat-hover-item-value">{item.value}</span> : null}
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="stat-hover-list">
                  {visibleItems.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="stat-hover-item-row">
                      <span className="stat-hover-item-label">{item.label}</span>
                      {item.value ? <span className="stat-hover-item-value">{item.value}</span> : null}
                    </div>
                  ))}
                </div>
              )}
              {(normalizedItems.length > 0 || hasHoverSections) ? (
                <button
                  type="button"
                  className="stat-view-all-btn"
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                >
                  View all
                </button>
              ) : null}
              {!hasHoverSections && hiddenCount > 0 ? <p className="stat-hover-more">+{hiddenCount} more</p> : null}
            </div>
          </div>
        ) : null}
        <h3>{value}</h3>
        {hint ? <small>{hint}</small> : null}
        {extra ? <p className="stat-extra">{extra}</p> : null}
      </article>

      {isModalOpen ? (
        <div className="stat-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="stat-modal-card card" onClick={(event) => event.stopPropagation()}>
            <div className="stat-modal-header">
              <p className="stat-hover-title">{hoverTitle || "Details"}</p>
              <button type="button" className="ghost" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
            <div className="stat-modal-list">
              {hasHoverSections ? (
                normalizedSections.map((section) => (
                  <div key={`modal-${section.title}`} className="stat-hover-section">
                    {section.title ? <p className="stat-hover-section-title">{section.title}</p> : null}
                    {section.layout === "pair" ? (
                      <div className="stat-hover-pair-grid">
                        {section.items.map((item) => (
                          <div key={`modal-${section.title}-${item.label}-${item.value}`} className="stat-hover-pair-cell">
                            <span className="stat-hover-pair-label">{item.label}</span>
                            {item.value ? <span className="stat-hover-pair-value">{item.value}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      section.items.map((item) => (
                        <div key={`modal-${section.title}-${item.label}-${item.value}`} className="stat-hover-item-row">
                          <span className="stat-hover-item-label">{item.label}</span>
                          {item.value ? <span className="stat-hover-item-value">{item.value}</span> : null}
                        </div>
                      ))
                    )}
                  </div>
                ))
              ) : (
                normalizedItems.map((item) => (
                  <div key={`modal-${item.label}-${item.value}`} className="stat-hover-item-row">
                    <span className="stat-hover-item-label">{item.label}</span>
                    {item.value ? <span className="stat-hover-item-value">{item.value}</span> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default StatCard;
