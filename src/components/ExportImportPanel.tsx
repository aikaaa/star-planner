/**
 * ExportImportPanel — 导出图片 + 导入计划 UI
 *
 * 布局：[导入计划（左）] [导出图片（右）]
 * 导出：html2canvas 截图 ExportTemplate，内嵌 QR 二维码
 * 导入：粘贴 SOC 文本 或 上传含二维码的图片
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Download, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterPlan } from "@/lib/types";
import { encodeSoc, decodeSoc, readQrFromImage } from "@/lib/socExport";
import ExportTemplate from "./ExportTemplate";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

interface Props {
  plans: CharacterPlan[];
  onImport: (plans: CharacterPlan[]) => void;
}

export default function ExportImportPanel({ plans, onImport }: Props) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText]   = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDragging, setIsDragging]   = useState(false);
  const [qrDataUrl, setQrDataUrl]     = useState<string | null>(null);

  const templateRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 关闭时清空状态
  const closeImport = useCallback(() => {
    setShowImport(false);
    setImportText("");
    setImportError(null);
  }, []);

  // ── 导出 ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (plans.length === 0) return;
    setIsExporting(true);

    try {
      const socStr = encodeSoc(plans);

      // 生成 QR 码 data URL
      const qr = await QRCode.toDataURL(socStr, {
        width: 128,
        margin: 1,
        errorCorrectionLevel: "L",
        color: { dark: "#26403c", light: "#ffffff" },
      });
      setQrDataUrl(qr);

      // 等 React 重渲染（带 QR 的模板）
      await new Promise<void>(resolve => setTimeout(resolve, 120));

      if (!templateRef.current) return;

      const canvas = await html2canvas(templateRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#f2f8f6",
        logging: false,
      });

      // 触发下载
      const link = document.createElement("a");
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      link.download = `铃兰跑片计划_${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("[ExportImportPanel] 导出失败", e);
    } finally {
      setIsExporting(false);
    }
  }, [plans]);

  // ── 导入：粘贴文本 ────────────────────────────────────────────────
  const handleImportText = useCallback(() => {
    const data = decodeSoc(importText.trim());
    if (!data) {
      setImportError("无法识别，请确认内容正确");
      return;
    }
    onImport(data.plans);
    closeImport();
  }, [importText, onImport, closeImport]);

  // ── 导入：读取图片二维码 ──────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImportError("请上传图片文件");
      return;
    }
    setImportError(null);

    const text = await readQrFromImage(file);
    if (!text) {
      setImportError("未能从图片识别到二维码，请确认是铃兰跑片助手导出的图片");
      return;
    }
    const data = decodeSoc(text);
    if (!data) {
      setImportError("二维码内容格式不正确");
      return;
    }
    onImport(data.plans);
    closeImport();
  }, [onImport, closeImport]);

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
      {/* 离屏模板（html2canvas 截图用） */}
      {plans.length > 0 && (
        <ExportTemplate ref={templateRef} plans={plans} qrDataUrl={qrDataUrl} />
      )}

      {/* 按钮行 */}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground h-10 text-sm font-medium"
          style={{ borderRadius: 4 }}
          onClick={() => setShowImport(true)}
        >
          <Upload className="mr-2 h-4 w-4 text-muted-foreground" />
          导入计划
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gradient-card border border-border text-foreground hover:text-foreground h-10 text-sm font-medium"
          style={{ borderRadius: 4 }}
          onClick={handleExport}
          disabled={plans.length === 0 || isExporting}
        >
          <Download className="mr-2 h-4 w-4 text-muted-foreground" />
          {isExporting ? "生成中…" : "导出图片"}
        </Button>
      </div>

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
              <span className="font-semibold text-sm">导入跑片计划</span>
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
                <p className="text-xs text-muted-foreground mb-2 font-medium">方式一：上传导出的图片</p>
                <div
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
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground text-center">
                    点击选择图片，或将图片拖拽到此处
                  </span>
                  <span className="text-xs text-muted-foreground">
                    自动识别图中二维码
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* 分隔线 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "hsl(var(--border) / 0.6)" }} />
                <span className="text-xs text-muted-foreground">或</span>
                <div className="flex-1 h-px" style={{ background: "hsl(var(--border) / 0.6)" }} />
              </div>

              {/* 方式 2：粘贴文本 */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">方式二：粘贴计划码</p>
                <textarea
                  className="w-full rounded-lg text-sm bg-muted/40 text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-primary"
                  style={{
                    border: "1px solid hsl(var(--border))",
                    padding: "10px 12px",
                    minHeight: 80,
                  }}
                  placeholder={"粘贴以 [SOC] 开头的计划码…"}
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setImportError(null); }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleImportText();
                  }}
                />
                {importError && (
                  <p className="text-xs mt-1.5" style={{ color: "hsl(var(--destructive))" }}>
                    {importError}
                  </p>
                )}
                <Button
                  className="mt-2 w-full gradient-primary text-primary-foreground"
                  style={{ borderRadius: 4 }}
                  onClick={handleImportText}
                  disabled={!importText.trim()}
                >
                  确认导入
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
