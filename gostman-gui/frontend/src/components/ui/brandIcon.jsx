import { Icon } from "@iconify/react/offline"
import onePassword from "@iconify-icons/simple-icons/1password"
import amazonWebServices from "@iconify-icons/simple-icons/amazonwebservices"
import anthropic from "@iconify-icons/simple-icons/anthropic"
import apple from "@iconify-icons/simple-icons/apple"
import bitbucket from "@iconify-icons/simple-icons/bitbucket"
import bitwarden from "@iconify-icons/simple-icons/bitwarden"
import bruno from "@iconify-icons/simple-icons/bruno"
import claude from "@iconify-icons/simple-icons/claude"
import cursor from "@iconify-icons/simple-icons/cursor"
import docker from "@iconify-icons/simple-icons/docker"
import github from "@iconify-icons/simple-icons/github"
import githubActions from "@iconify-icons/simple-icons/githubactions"
import gitlab from "@iconify-icons/simple-icons/gitlab"
import googleCloud from "@iconify-icons/simple-icons/googlecloud"
import googleGemini from "@iconify-icons/simple-icons/googlegemini"
import insomnia from "@iconify-icons/simple-icons/insomnia"
import keepassxc from "@iconify-icons/simple-icons/keepassxc"
import linux from "@iconify-icons/simple-icons/linux"
import microsoftAzure from "@iconify-icons/simple-icons/microsoftazure"
import ollama from "@iconify-icons/simple-icons/ollama"
import openai from "@iconify-icons/simple-icons/openai"
import openapi from "@iconify-icons/simple-icons/openapiinitiative"
import openrouter from "@iconify-icons/simple-icons/openrouter"
import postman from "@iconify-icons/simple-icons/postman"
import vault from "@iconify-icons/simple-icons/vault"
import windows from "@iconify-icons/simple-icons/windows"
import { lookup } from "../../lib/dataUtils"
import { cn } from "../../lib/utils"

const BRAND_ICONS = {
  github,
  "github-actions": githubActions,
  gitlab,
  bitbucket,
  vault,
  aws: amazonWebServices,
  azure: microsoftAzure,
  gcp: googleCloud,
  keepassxc,
  onepassword: onePassword,
  bitwarden,
  "bitwarden-secrets": bitwarden,
  anthropic,
  claude,
  openai,
  gemini: googleGemini,
  openrouter,
  ollama,
  cursor,
  postman,
  insomnia,
  bruno,
  openapi,
  macos: apple,
  windows,
  linux,
  docker,
}

const ICON_SIZE = "h-3.5 w-3.5 shrink-0"

export function BrandIcon({ brand, fallback: Fallback, className }) {
  const icon = lookup(BRAND_ICONS, brand)
  if (icon) return <Icon icon={icon} aria-hidden="true" className={cn(ICON_SIZE, className)} />
  return Fallback ? <Fallback aria-hidden="true" className={cn(ICON_SIZE, className)} /> : null
}

export function BrandStrip({ brands, className }) {
  if (!brands?.length) return null
  return (
    <span aria-hidden="true" className={cn("flex flex-wrap items-center gap-3 text-muted-foreground", className)}>
      {brands.map((brand) => <BrandIcon key={brand} brand={brand} className="h-4 w-4" />)}
    </span>
  )
}
