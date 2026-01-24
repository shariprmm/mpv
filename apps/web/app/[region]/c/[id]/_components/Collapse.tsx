"use client";

import React, { useState } from "react";
import styles from "../page.module.css";

export default function Collapse(props: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const { title, defaultOpen = false, children } = props;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`${styles.Card} ${styles.CollapseCard}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={styles.CollapseBtn}
        aria-expanded={open}
      >
        <div className={styles.CollapseTitle}>{title}</div>
        <div className={styles.CollapseChevron}>{open ? "▴" : "▾"}</div>
      </button>

      {open ? <div className={styles.CollapseBody}>{children}</div> : null}
    </section>
  );
}
