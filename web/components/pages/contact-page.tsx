"use client";

/**
 * 页面名称：联系我们 ContactPage
 * 页面用途：官网核心业务转化页，承接客户咨询、项目需求与模型服务需求
 * 主要功能：Hero、咨询表单、我们可以提供、联系方式、服务流程、服务方向、CTA、Footer
 * 对应文档：页面功能注释文档/11_联系我们_ContactPage.md
 * 说明：表单接入 GET /api/contact/options、POST /api/contact/leads；三态 loading/success/error；
 *       全站 NavBar 由 layout SiteChrome 挂载。
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Scan,
  Layers,
  Box,
  Brain,
  Monitor,
  Network,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useSiteConfig } from "@/components/providers/site-config-provider";
import { getContactOptions, createLead } from "@/lib/api/contact";
import { ApiError } from "@/lib/http";

const DEFAULT_SCENE_OPTIONS = [
  "工程改造",
  "数字文旅",
  "游戏影视",
  "数字存档",
  "云上营销",
  "数字运维",
  "具身智能空间训练",
  "数字孪生",
  "其他",
];

const DEFAULT_DATA_TYPE_OPTIONS = [
  "实景三维",
  "BIM 模型",
  "构件级模型",
  "具身智能空间训练场景模型",
  "云端模型展示",
  "数字孪生平台接入",
  "其他",
];

const DEFAULT_STAGE_OPTIONS = [
  "前期咨询",
  "已有项目需求",
  "已有模型数据",
  "需要定制采集与建模",
  "需要平台接入",
  "其他",
];

const DEFAULT_BUDGET_OPTIONS = [
  "暂不确定",
  "1万以内",
  "1万-5万",
  "5万-10万",
  "10万以上",
  "定制沟通",
];

const processSteps = [
  {
    num: "01",
    title: "需求沟通",
    desc: "了解业务场景、空间类型、数据用途与交付目标。",
  },
  {
    num: "02",
    title: "方案确认",
    desc: "确定数据类型、服务范围、展示方式与交付形式。",
  },
  {
    num: "03",
    title: "数据处理",
    desc: "进行实景重建、BIM 模型处理、构件级模型整理或训练场景数据处理。",
  },
  {
    num: "04",
    title: "交付接入",
    desc: "支持云端展示、模型查看、平台接入与后续服务对接。",
  },
];

const serviceDirections = [
  {
    icon: <Scan className="w-5 h-5" />,
    title: "实景三维数据服务",
    desc: "适用于线上展示、数字文旅、云上营销与空间存档。",
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: "BIM 模型服务",
    desc: "适用于工程改造、数字运维、楼宇管理与数字孪生接入。",
  },
  {
    icon: <Box className="w-5 h-5" />,
    title: "构件级模型服务",
    desc: "适用于资产管理、场景搭建、设备对象表达与精细化模型组织。",
  },
  {
    icon: <Monitor className="w-5 h-5" />,
    title: "云端模型展示",
    desc: "支持模型在线浏览、远程演示、项目汇报与客户展示。",
  },
  {
    icon: <Network className="w-5 h-5" />,
    title: "数字孪生平台接入",
    desc: "支持三维空间数据接入数字孪生管理系统。",
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: "具身智能空间训练数据",
    desc: "为机器人感知、导航、交互、任务理解与空间推理提供训练场景数据。",
  },
];

const serviceItems = [
  "实景重建",
  "BIM 模型处理",
  "构件级模型处理",
  "云端模型展示",
  "数字孪生平台接入",
  "具身智能空间训练数据处理",
];

const inputClass =
  "w-full bg-white/[0.04] border border-white/10 rounded-[12px] px-4 py-3 text-[14px] text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/40 transition-colors";

export default function ContactPage() {
  const { config } = useSiteConfig();

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [contactWay, setContactWay] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedScene, setSelectedScene] = useState("");
  const [selectedBudget, setSelectedBudget] = useState("");

  const [sceneOptions, setSceneOptions] = useState<string[]>(DEFAULT_SCENE_OPTIONS);
  const [dataTypeOptions, setDataTypeOptions] = useState<string[]>(DEFAULT_DATA_TYPE_OPTIONS);
  const [stageOptions, setStageOptions] = useState<string[]>(DEFAULT_STAGE_OPTIONS);
  const [budgetOptions, setBudgetOptions] = useState<string[]>(DEFAULT_BUDGET_OPTIONS);

  useEffect(() => {
    getContactOptions()
      .then((opts) => {
        if (opts.scenes?.length) setSceneOptions(opts.scenes);
        if (opts.dataTypes?.length) setDataTypeOptions(opts.dataTypes);
        if (opts.stages?.length) setStageOptions(opts.stages);
        if (opts.budgets?.length) setBudgetOptions(opts.budgets);
      })
      .catch(() => {
        // 选项接口失败：保留本地默认选项
      });
  }, []);

  const toggleDataType = (t: string) => {
    setSelectedDataTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const resetForm = () => {
    setName("");
    setContactWay("");
    setCompany("");
    setEmail("");
    setMessage("");
    setSelectedDataTypes([]);
    setSelectedStage("");
    setSelectedScene("");
    setSelectedBudget("");
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!name.trim()) {
      toast.error("请填写姓名");
      return;
    }
    if (!contactWay.trim()) {
      toast.error("请填写手机 / 微信");
      return;
    }
    setSubmitting(true);
    try {
      await createLead({
        name: name.trim(),
        contactWay: contactWay.trim(),
        company: company.trim() || undefined,
        email: email.trim() || undefined,
        scene: selectedScene || undefined,
        dataTypes: selectedDataTypes.length ? selectedDataTypes : undefined,
        stage: selectedStage || undefined,
        budget: selectedBudget || undefined,
        message: message.trim() || undefined,
      });
      toast.success("需求已提交，我们将尽快与你联系");
      setSubmitted(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden -mt-16 md:-mt-[72px]">
      <section className="relative min-h-[480px] md:min-h-[560px] flex items-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 70% 50%, rgba(96,165,250,0.07) 0%, transparent 60%)",
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="relative max-w-[1200px] mx-auto px-5 md:px-6 pt-24 md:pt-32 pb-16 md:pb-24 w-full">
          <div className="inline-flex items-center gap-2 border border-white/15 bg-white/5 text-[13px] text-gray-300 px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
            联系我们
          </div>
          <h1 className="text-[34px] md:text-[54px] font-bold leading-tight mb-4">
            获取真实三维空间数据服务
          </h1>
          <p className="text-[15px] md:text-[17px] text-gray-300 mb-4 max-w-[600px]">
            告诉我们你的业务场景，我们将为你提供实景三维、BIM 模型、构件级模型、云端展示、数字孪生接入与具身智能空间训练数据服务。
          </p>
          <p className="text-[14px] text-gray-500 mb-10 max-w-[560px]">
            无论是工程改造、数字文旅、游戏影视、数字存档、云上营销、数字运维，还是具身智能空间训练，我们都可以根据项目需求提供三维空间数据服务方案。
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={scrollToForm}
              className="px-8 py-3.5 rounded-full bg-white text-black text-[15px] font-medium hover:bg-gray-100 transition-all inline-flex items-center justify-center gap-2"
            >
              提交需求
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              href="/models"
              className="px-8 py-3.5 rounded-full border border-white/30 text-white text-[15px] hover:bg-white/5 transition-all text-center"
            >
              查看模型库
            </Link>
          </div>
        </div>
      </section>

      <section id="contact-form" className="py-16 md:py-24 bg-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="mb-10">
            <h2 className="text-[26px] md:text-[36px] font-bold mb-3">提交你的项目需求</h2>
            <p className="text-gray-400 text-[15px]">
              填写以下信息，我们将根据你的业务场景进行需求评估与服务对接。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
            <div className="bg-white/[0.025] border border-white/10 rounded-[24px] p-6 md:p-8">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mb-5">
                    <CheckCircle2 className="w-7 h-7 text-cyan-400" />
                  </div>
                  <h3 className="text-[20px] font-semibold mb-3">
                    需求已提交，我们将尽快与你联系。
                  </h3>
                  <p className="text-[14px] text-gray-500 mb-8 max-w-[360px]">
                    感谢你的信任，我们将根据你提交的业务信息进行初步评估，并通过预留的联系方式与你进一步沟通项目方案。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      resetForm();
                    }}
                    className="px-6 py-2.5 rounded-full border border-white/20 text-white text-[14px] hover:bg-white/5 transition-all"
                  >
                    返回表单
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[13px] text-gray-400 mb-2">姓名</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="请输入您的姓名"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] text-gray-400 mb-2">手机 / 微信</label>
                      <input
                        type="text"
                        value={contactWay}
                        onChange={(e) => setContactWay(e.target.value)}
                        placeholder="请输入手机号或微信号"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] text-gray-400 mb-2">公司名称</label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="请输入公司名称"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] text-gray-400 mb-2">联系邮箱</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="请输入联系邮箱"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] text-gray-400 mb-2">业务场景</label>
                    <select
                      value={selectedScene}
                      onChange={(e) => setSelectedScene(e.target.value)}
                      className={inputClass + " bg-[#111] appearance-none cursor-pointer"}
                    >
                      <option value="" disabled className="bg-[#111] text-gray-600">
                        请选择业务场景
                      </option>
                      {sceneOptions.map((opt) => (
                        <option key={opt} value={opt} className="bg-[#111]">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[13px] text-gray-400 mb-3">所需数据类型</label>
                    <div className="flex flex-wrap gap-2">
                      {dataTypeOptions.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleDataType(t)}
                          className={`px-3.5 py-1.5 rounded-full border text-[13px] transition-all ${
                            selectedDataTypes.includes(t)
                              ? "bg-cyan-400/[0.08] border-cyan-400/40 text-cyan-300"
                              : "bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] text-gray-400 mb-3">项目阶段</label>
                    <div className="flex flex-wrap gap-2">
                      {stageOptions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedStage(s)}
                          className={`px-3.5 py-1.5 rounded-full border text-[13px] transition-all ${
                            selectedStage === s
                              ? "bg-cyan-400/[0.08] border-cyan-400/40 text-cyan-300"
                              : "bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] text-gray-400 mb-2">项目需求描述</label>
                    <textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="请简单描述你的空间类型、项目用途、期望交付内容或需要解决的问题"
                      className={inputClass + " resize-none"}
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] text-gray-400 mb-2">预算范围</label>
                    <select
                      value={selectedBudget}
                      onChange={(e) => setSelectedBudget(e.target.value)}
                      className={inputClass + " bg-[#111] appearance-none cursor-pointer"}
                    >
                      <option value="" disabled className="bg-[#111] text-gray-600">
                        请选择预算范围
                      </option>
                      {budgetOptions.map((opt) => (
                        <option key={opt} value={opt} className="bg-[#111]">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-3.5 rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? "提交中…" : "提交需求"}
                  </button>
                </div>
              )}
            </div>

            <div className="sticky top-28 space-y-4 self-start">
              <div className="bg-white/[0.025] border border-white/10 rounded-[20px] p-6">
                <h3 className="text-[15px] font-semibold mb-4">我们可以提供</h3>
                <div className="space-y-3 mb-5">
                  {serviceItems.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 flex-shrink-0" />
                      <span className="text-[14px] text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  提交后，我们将根据你的需求进行初步评估，并与你进一步沟通项目方案。
                </p>
              </div>

              <div className="bg-white/[0.025] border border-white/10 rounded-[20px] p-6">
                <h3 className="text-[15px] font-semibold mb-4">联系方式</h3>
                <div className="space-y-2 text-[14px] text-gray-500">
                  <p>电话：{config.phone}</p>
                  <p>邮箱：{config.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="mb-10">
            <h2 className="text-[26px] md:text-[36px] font-bold mb-3">服务流程</h2>
            <p className="text-gray-400 text-[15px]">
              从需求沟通到数据交付，构建清晰可控的三维空间数据服务流程。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {processSteps.map((step, i) => (
              <div
                key={step.num}
                className="bg-white/[0.025] border border-white/10 rounded-[20px] p-6 relative"
              >
                <div className="text-[40px] font-bold text-white/[0.07] mb-3 leading-none">
                  {step.num}
                </div>
                <h3 className="text-[16px] font-semibold mb-2">{step.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{step.desc}</p>
                {i < processSteps.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="mb-10">
            <h2 className="text-[26px] md:text-[36px] font-bold mb-3">服务方向</h2>
            <p className="text-gray-400 text-[15px]">
              围绕真实三维空间数据，为不同业务场景提供定制化数据服务。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {serviceDirections.map((dir) => (
              <div
                key={dir.title}
                className="group bg-white/[0.025] border border-white/10 rounded-[20px] p-6 hover:border-cyan-500/30 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 text-cyan-400/70 group-hover:text-cyan-400 transition-colors">
                  {dir.icon}
                </div>
                <h3 className="text-[16px] font-semibold mb-2">{dir.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{dir.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="relative rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-8 md:p-16 text-center overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.6) 1px, transparent 0)",
                backgroundSize: "36px 36px",
              }}
            />
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-[24px] md:text-[40px] font-bold mb-4 leading-tight">
                让真实空间成为可拓展的三维数据资产
              </h2>
              <p className="text-[15px] md:text-[17px] text-gray-400 mb-8 md:mb-10 max-w-2xl mx-auto">
                提交你的项目需求，我们将根据业务场景提供对应的空间数据服务方案。
              </p>
              <button
                type="button"
                onClick={scrollToForm}
                className="px-10 py-3.5 rounded-full bg-white text-black text-[15px] font-medium hover:bg-gray-100 transition-all inline-flex items-center gap-2"
              >
                提交需求
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative bg-black border-t border-white/10 py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-10 md:mb-12">
            <div>
              <div className="flex items-center mb-4 md:mb-6">
                <img
                  src="/loading/loading-logo-reference1.png"
                  alt="数境空间"
                  className="h-[57px] w-auto object-contain"
                />
              </div>
              <p className="text-[14px] text-gray-500">{config.companyName}</p>
            </div>
            <div>
              <h4 className="text-[15px] md:text-[16px] font-semibold mb-4">联系方式</h4>
              <div className="space-y-2 text-[14px] text-gray-500">
                <p>电话：{config.phone}</p>
                <p>邮箱：{config.email}</p>
                <p>地址：{config.address}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[15px] md:text-[16px] font-semibold mb-4">导航</h4>
              <div className="space-y-2 text-[14px]">
                <Link href="/" className="block text-gray-500 hover:text-white transition-colors">
                  首页
                </Link>
                <Link
                  href="/community"
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  模型社区
                </Link>
                <Link
                  href="/about"
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  关于我们
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-6 md:pt-8 border-t border-white/10 text-center">
            <p className="text-[12px] md:text-[13px] text-gray-600">{config.footerText}</p>
            {config.icp && (
              <p className="mt-2 text-[12px] md:text-[13px] text-gray-600">{config.icp}</p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

