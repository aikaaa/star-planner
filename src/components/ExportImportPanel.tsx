/**
 * ExportImportPanel — 导出图片 + 导入计划 UI
 *
 * 布局：[导入计划（左）] [导出图片（右）]
 * 导出：html2canvas 截图 ExportTemplate，内嵌 QR 二维码
 * 导入：粘贴 SOC 文本 或 上传含二维码的图片
 */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { useSearchParams } from "react-router-dom";
import { X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useI18n } from "@/lib/i18n";
import { CharacterPlan } from "@/lib/types";
import { encodeSocForQr, decodeSoc, downloadSocRef, readQrFromImage, parseImportId } from "@/lib/socExport";
import ExportTemplate from "./ExportTemplate";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

interface Props {
  plans: CharacterPlan[];
  onImport: (plans: CharacterPlan[]) => void;
  onExportingChange?: (exporting: boolean) => void;
}

export interface ExportImportHandle {
  openImport: () => void;
  startExport: () => void;
}

const ExportImportPanel = forwardRef<ExportImportHandle, Props>(function ExportImportPanel({ plans, onImport, onExportingChange }, ref) {
  const { t } = useI18n();
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText]   = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDragging, setIsDragging]   = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [qrDataUrl, setQrDataUrl]     = useState<string | null>(null);
  // 待确认的导入数据（有现有计划时需用户确认替换）
  const [pendingPlans, setPendingPlans] = useState<CharacterPlan[] | null>(null);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportFileName, setExportFileName] = useState<string>("SocPlan.png");

  const templateRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // 关闭时清空状态
  const closeImport = useCallback(() => {
    setShowImport(false);
    setImportText("");
    setImportError(null);
    setCodeError(null);
    setIsProcessingFile(false);
  }, []);

  // ── 导出 ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (plans.length === 0) return;
    setIsExporting(true);
    onExportingChange?.(true);

    try {
      // 数据短则直接编码，过长则上传 Supabase 返回短 ID
      const qrContent = await encodeSocForQr(plans);

      // 生成 QR 码 data URL（内容已足够短，版本低、模块大，jsQR 可靠识别）
      const qr = await QRCode.toDataURL(qrContent, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: "L",
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(qr);

      // 等 React 重渲染（带 QR 的模板）
      await new Promise<void>(resolve => setTimeout(resolve, 200));

      if (!templateRef.current) return;

      const canvas = await html2canvas(templateRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#f2f8f6",
        logging: false,
      });

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      setExportFileName(`SocPlan_${dateStr}.png`);
      setExportPreviewUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("[ExportImportPanel] 导出失败", e);
      toast.error(t.toast.exportFail);
    } finally {
      setIsExporting(false);
      onExportingChange?.(false);
    }
  }, [plans]);

  // ── 导入完成的统一处理 ────────────────────────────────────────────
  const finishImport = useCallback((importedPlans: CharacterPlan[]) => {
    onImport(importedPlans);
    closeImport();
    setPendingPlans(null);
    toast.success(t.toast.importSuccess);
  }, [onImport, closeImport]);

  // ── 触发导入：有现有数据则弹确认，否则直接导入 ───────────────────
  const triggerImport = useCallback((importedPlans: CharacterPlan[], currentPlans: CharacterPlan[]) => {
    if (currentPlans.length > 0) {
      setPendingPlans(importedPlans);
      setShowImport(false);
    } else {
      finishImport(importedPlans);
    }
  }, [finishImport]);

  // ── 解析 QR/URL/文本，返回 SOC 字符串或 null ─────────────────────
  const resolveSocText = useCallback(async (raw: string): Promise<string | null> => {
    const parsed = parseImportId(raw);
    if (parsed.type === "direct") return parsed.socText ?? null;
    const id = parsed.id!;
    const remote = await downloadSocRef(id);
    return remote;
  }, []);

  // ── 导入：粘贴文本 ────────────────────────────────────────────────
  const handleImportText = useCallback(async () => {
    setCodeError(null);
    const socText = await resolveSocText(importText.trim());
    if (!socText) { setCodeError(t.importDialog.planCodeError); return; }
    const data = decodeSoc(socText);
    if (!data) { setCodeError(t.importDialog.planCodeError); return; }
    triggerImport(data.plans, plans);
  }, [importText, resolveSocText, triggerImport, plans, t]);

  // ── 导入：读取图片二维码 ──────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImportError(t.importDialog.errorNotImage);
      return;
    }
    setImportError(null);
    setIsProcessingFile(true);

    try {
      const text = await readQrFromImage(file);
      if (!text) {
        setImportError(t.importDialog.errorNoQR);
        return;
      }
      const socText = await resolveSocText(text);
      if (!socText) { setImportError(t.toast.planExpired); return; }
      const data = decodeSoc(socText);
      if (!data) { setImportError(t.importDialog.errorQRFormat); return; }
      triggerImport(data.plans, plans);
    } finally {
      setIsProcessingFile(false);
    }
  }, [resolveSocText, triggerImport, plans]);

  // ── 页面加载时检测 ?import= 参数（扫码打开网页） ─────────────────
  useEffect(() => {
    const importId = searchParams.get("import");
    if (!importId) return;
    // 立即清除 URL 参数，避免刷新重复触发
    setSearchParams({}, { replace: true });
    (async () => {
      try {
        const remote = await downloadSocRef(importId);
        if (!remote) { toast.error(t.toast.planExpired); return; }
        const data = decodeSoc(remote);
        if (!data) { toast.error(t.toast.planFormatError); return; }
        triggerImport(data.plans, plans);
      } catch {
        toast.error(t.toast.planLoadFail);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 暴露给父组件的方法 ────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    openImport: () => setShowImport(true),
    startExport: handleExport,
  }), [handleExport]);

  // ── 拖拽 ─────────────────────────────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── ESC 关闭 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!showImport) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeImport(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showImport, closeImport]);

  return (
    <>
      {/* 导出图片预览弹窗 */}
      {exportPreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setExportPreviewUrl(null)}
        >
          <div
            className="flex flex-col items-center gap-3 mx-4"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={exportPreviewUrl}
              alt="导出图片"
              style={{ maxWidth: "min(400px, 90vw)", maxHeight: "70vh", borderRadius: 8, display: "block" }}
            />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              {t.export.saveInstruction}
            </p>
            <div className="flex gap-2">
              <a
                href={exportPreviewUrl}
                download={exportFileName}
                className="text-xs px-4 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.9)", color: "#333", textDecoration: "none" }}
              >
                {t.export.download}
              </a>
              <button
                onClick={() => setExportPreviewUrl(null)}
                className="text-xs px-4 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
              >
                {t.export.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 替换确认弹窗 */}
      {pendingPlans && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="bg-card text-card-foreground rounded-xl shadow-2xl mx-4 w-full max-w-sm"
            style={{ border: "1px solid hsl(var(--border))", padding: "24px" }}
          >
            <h3 className="font-semibold mb-2">{t.importDialog.replaceTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {t.importDialog.replaceDesc1} {plans.length} {t.importDialog.replaceDesc2}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                style={{ borderRadius: 4 }}
                onClick={() => setPendingPlans(null)}
              >
                {t.importDialog.cancel}
              </Button>
              <Button
                className="flex-1 gradient-primary text-primary-foreground"
                style={{ borderRadius: 4 }}
                onClick={() => finishImport(pendingPlans)}
              >
                {t.importDialog.confirmReplace}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 离屏模板（html2canvas 截图用） */}
      {plans.length > 0 && (
        <ExportTemplate ref={templateRef} plans={plans} qrDataUrl={qrDataUrl} />
      )}

      {/* 导入弹窗 */}
      {showImport && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeImport(); }}
        >
          <div
            className="bg-card text-card-foreground w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl"
            style={{ border: "1px solid hsl(var(--border))", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3"
              style={{ borderBottom: "1px solid hsl(var(--border) / 0.6)" }}>
              <span className="font-semibold text-sm">{t.importDialog.title}</span>
              <button
                onClick={closeImport}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 方式 1：图片上传 */}
              <div>
                <p className="text-xs text-muted-foreground font-medium" style={{ marginBottom: 2 }}>{t.importDialog.method1}</p>

                {/* input 覆盖整个区域，避免 JS 模拟点击在某些浏览器失效 */}
                <label
                  className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{
                    borderColor: isDragging
                      ? "hsl(var(--primary))"
                      : "hsl(var(--border))",
                    background: isDragging
                      ? "hsl(var(--primary) / 0.06)"
                      : "hsl(var(--muted) / 0.3)",
                    padding: "24px 16px",
                    minHeight: 100,
                    display: "flex",
                    position: "relative",
                  }}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/*"
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = "";
                    }}
                  />
                  {isProcessingFile ? (
                    <>
                      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span className="text-sm text-muted-foreground">{t.importDialog.recognizing}</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground text-center">
                        {t.importDialog.uploadInstruction}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t.importDialog.uploadHint}
                      </span>
                    </>
                  )}
                </label>

                {importError && (
                  <p className="text-xs mt-2" style={{ color: "hsl(var(--destructive))" }}>
                    {importError}
                  </p>
                )}
              </div>

              {/* 分隔线 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "hsl(var(--border) / 0.6)" }} />
                <span className="text-xs text-muted-foreground">{t.importDialog.or}</span>
                <div className="flex-1 h-px" style={{ background: "hsl(var(--border) / 0.6)" }} />
              </div>

              {/* 方式 2：粘贴文本 */}
              <div>
                <p className="text-xs text-muted-foreground font-medium" style={{ marginBottom: 2 }}>{t.importDialog.method2}</p>
                <textarea
                  className="w-full rounded-lg text-xs text-foreground placeholder:text-sm placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-primary"
                  style={{
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--muted) / 0.3)",
                    padding: "10px 12px",
                    minHeight: 80,
                  }}
                  placeholder={t.importDialog.codePlaceholder}
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setCodeError(null); }}
                  onFocus={e => {
                    const el = e.currentTarget;
                    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleImportText();
                  }}
                />
                {codeError && (
                  <p className="text-xs mt-1" style={{ color: "hsl(var(--destructive))" }}>
                    {codeError}
                  </p>
                )}
                <Button
                  className="mt-2 w-full gradient-primary text-primary-foreground"
                  style={{ borderRadius: 4 }}
                  onClick={handleImportText}
                  disabled={!importText.trim()}
                >
                  {t.importDialog.confirmImport}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default ExportImportPanel;
