"use client";

/**
 * 组件名称：TrainingModal
 * 组件用途：具身智能机器人训练数据服务申请弹窗（仅机器人训练场景）
 * 主要功能：表单填写、POST /api/training-applications、loading/error/success 三态
 * 对应文档：页面功能注释文档/08_训练数据服务申请_TrainingModal.md
 */
import { useState } from "react";
import { X, Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTrainingApplication } from "@/lib/api/training";
import { ROBOT_TYPES, TRAIN_TASKS } from "@/lib/model-library-constants";
import { ApiError } from "@/lib/http";

interface TrainingModalProps {
  onClose: () => void;
}

export function TrainingModal({ onClose }: TrainingModalProps) {
  // contactName：联系人（必填，对应 contact_name）
  const [contactName, setContactName] = useState("");
  // contactWay：手机 / 微信（必填，对应 contact_way）
  const [contactWay, setContactWay] = useState("");
  // company：公司名称（必填）
  const [company, setCompany] = useState("");
  // robotType：机器人类型下拉（必填，默认首项）
  const [robotType, setRobotType] = useState<string>(ROBOT_TYPES[0]);
  // sceneDesc：场景需求描述（必填）
  const [sceneDesc, setSceneDesc] = useState("");
  // selectedTasks：训练任务多选，对应 train_tasks
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  // submitted：提交成功态
  const [submitted, setSubmitted] = useState(false);
  // submitting：提交进行中，防连点 + 按钮 loading
  const [submitting, setSubmitting] = useState(false);

  const toggleTask = (t: string) =>
    setSelectedTasks((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const handleSubmit = async () => {
    if (submitting) return;
    if (!contactName.trim()) {
      toast.error("请填写联系人");
      return;
    }
    if (!contactWay.trim()) {
      toast.error("请填写手机 / 微信");
      return;
    }
    if (!company.trim()) {
      toast.error("请填写公司名称");
      return;
    }
    if (!sceneDesc.trim()) {
      toast.error("请填写场景需求描述");
      return;
    }
    setSubmitting(true);
    try {
      await createTrainingApplication({
        contactName: contactName.trim(),
        contactWay: contactWay.trim(),
        company: company.trim(),
        robotType,
        trainTasks: selectedTasks.length ? selectedTasks : undefined,
        sceneDesc: sceneDesc.trim(),
      });
      setSubmitted(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative bg-[#111] border border-white/10 rounded-2xl p-10 text-center max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-violet-400" />
          </div>
          <h3 className="text-[18px] font-semibold mb-2">申请已提交</h3>
          <p className="text-[14px] text-gray-400">申请已提交，我们将尽快与你联系。</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 px-6 py-2.5 rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#111] border-b border-white/10 flex items-center justify-between px-5 py-4 z-10">
          <div>
            <h2 className="text-[17px] font-semibold">申请训练数据服务</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              请填写你的训练场景需求，我们将根据机器人类型、任务目标与空间环境进行数据服务对接。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[13px] text-gray-400 block mb-1.5">联系人</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label className="text-[13px] text-gray-400 block mb-1.5">手机 / 微信</label>
              <input
                value={contactWay}
                onChange={(e) => setContactWay(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                placeholder="请输入手机或微信"
              />
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">公司名称</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
              placeholder="请输入公司名称"
            />
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">机器人类型</label>
            <div className="relative">
              <select
                value={robotType}
                onChange={(e) => setRobotType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-gray-300 focus:outline-none appearance-none focus:border-white/20 transition-all"
              >
                {ROBOT_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#111]">
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">训练任务（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {TRAIN_TASKS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTask(t)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${
                    selectedTasks.includes(t)
                      ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">场景需求描述</label>
            <textarea
              rows={3}
              value={sceneDesc}
              onChange={(e) => setSceneDesc(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none resize-none focus:border-white/20 transition-all"
              placeholder="请描述你需要的训练空间类型、任务目标和数据用途"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-gray-300 hover:bg-white/8 transition-all"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-violet-500 text-white text-[14px] font-medium hover:bg-violet-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "提交中…" : "提交申请"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
