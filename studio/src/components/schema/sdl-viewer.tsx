import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { useUser } from "@/hooks/use-user";
import { downloadStringAsFile } from "@/lib/download-string-as-file";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  ClipboardCopyIcon,
  DotsHorizontalIcon,
  DownloadIcon,
  GearIcon,
} from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import {
  getAllDiscussions,
  getOrganizationMembers,
} from "@wundergraph/cosmo-connect/dist/platform/v1/platform-PlatformService_connectquery";
import copy from "copy-to-clipboard";
import Link from "next/link";
import { useRouter } from "next/router";
import babelPlugin from "prettier/plugins/babel";
import estreePlugin from "prettier/plugins/estree";
import graphQLPlugin from "prettier/plugins/graphql";
import * as prettier from "prettier/standalone";
import { Highlight, themes } from "prism-react-renderer";
import * as Prism from "prismjs";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-json";
import { useEffect, useState } from "react";
import { useApplyParams } from "../analytics/use-apply-params";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { useToast } from "../ui/use-toast";
import { CommentCard, NewDiscussion } from "../discussions/discussion";

export const hideDiscussionsKey = "hide-discussions";
export const hideResolvedDiscussionsKey = "hide-resolved-discussions";

export const SchemaSettings = ({
  size = "icon",
}: {
  size?: "icon" | "icon-sm";
}) => {
  const [hideDiscussions, setHideDiscussions] = useLocalStorage(
    hideDiscussionsKey,
    false,
  );

  const [hideResolvedDiscussions, setHideResolvedDiscussions] = useLocalStorage(
    hideResolvedDiscussionsKey,
    true,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex-shrink-0" variant="secondary" size={size}>
          <GearIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={hideDiscussions}
          onCheckedChange={setHideDiscussions}
        >
          Hide discussions
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hideResolvedDiscussions}
          onCheckedChange={setHideResolvedDiscussions}
        >
          Hide resolved discussions
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SDLViewerActions = ({
  sdl,
  className,
  size = "icon",
}: {
  sdl: string;
  className?: string;
  size?: "icon" | "icon-sm";
}) => {
  const { toast, dismiss } = useToast();

  const downloadSDL = () => {
    downloadStringAsFile(sdl, `schema.graphql`, `application/graphql`);
  };

  const copySDL = () => {
    copy(sdl);
    const { id } = toast({ description: "Copied contents to clipboard" });

    const t = setTimeout(() => {
      dismiss(id);
    }, 2000);

    return () => clearTimeout(t);
  };

  return (
    <div
      className={cn("flex w-full items-center gap-x-2 md:w-auto", className)}
    >
      <Button variant="secondary" size={size} onClick={() => copySDL()}>
        <ClipboardCopyIcon />
      </Button>
      <Button variant="secondary" size={size} onClick={downloadSDL}>
        <DownloadIcon />
      </Button>
    </div>
  );
};

const LineActions = ({
  lineNo,
  setNewDiscussionLine,
}: {
  lineNo: number;
  setNewDiscussionLine: (line: number) => void;
}) => {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="secondary"
          className="invisible absolute left-1.5 !h-auto !rounded-sm group-hover:visible data-[state=open]:visible"
        >
          <DotsHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            copy(`${window.location.href.split("#")[0]}#L${lineNo}`);
            toast({
              description: "Copied link to clipboard",
            });
          }}
        >
          Copy link to line
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setNewDiscussionLine(lineNo);
          }}
        >
          Start new discussion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SDLViewer = ({
  sdl,
  className,
  versionId,
  targetId,
}: {
  sdl: string;
  className?: string;
  versionId: string;
  targetId: string;
}) => {
  const router = useRouter();

  const applyParams = useApplyParams();

  const discussionId = router.query.discussionId as string;

  const pathname = router.asPath.split("#")[0];
  const hash = router.asPath.split("#")?.[1];

  const [content, setContent] = useState("");

  const { data, refetch } = useQuery({
    ...getAllDiscussions.useQuery({
      schemaVersionId: versionId,
      targetId,
    }),
  });

  const user = useUser();

  const { data: membersData } = useQuery({
    ...getOrganizationMembers.useQuery(),
    queryKey: [
      user?.currentOrganization.slug || "",
      "GetOrganizationMembers",
      {},
    ],
  });

  const discussions = data?.discussions;

  const [hideDiscussions] = useLocalStorage(hideDiscussionsKey, false);

  const [hideResolvedDiscussions] = useLocalStorage(
    hideResolvedDiscussionsKey,
    false,
  );

  useEffect(() => {
    const set = async (source: string) => {
      try {
        const res = await prettier.format(source, {
          parser: "graphql",
          plugins: [graphQLPlugin, estreePlugin, babelPlugin],
        });
        setContent(res);
      } catch {
        setContent("INVALID CONTENT");
      }
    };

    if (!sdl) return;
    set(sdl);
  }, [sdl]);

  const selectedTheme = useResolvedTheme();

  const [newDiscussionLine, setNewDiscussionLine] = useState(-1);

  return (
    <Highlight
      theme={selectedTheme === "dark" ? themes.nightOwl : themes.nightOwlLight}
      code={content}
      language="graphql"
      prism={Prism}
    >
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          style={{ ...style, background: "", backgroundColor: "" }}
          className={cn("text-xs", className)}
        >
          {tokens.map((line, i, allLines) => {
            const numberSectionWidth =
              allLines.length > 10
                ? allLines.length > 100
                  ? allLines.length > 1000
                    ? "w-20"
                    : "w-[72px]"
                  : "w-14"
                : "w-10";

            const lineNo = `L${i + 1}`;

            const href = pathname + `#${lineNo}`;

            const lineDiscussions =
              discussions
                ?.filter((d) => d.referenceLine === i + 1)
                .filter((ld) => !(ld.isResolved && hideResolvedDiscussions)) ??
              [];

            return (
              <div
                id={`id-${lineNo}`}
                key={i.toString()}
                {...getLineProps({ line })}
                className={cn(
                  getLineProps({ line }).className,
                  "group",
                  hash === lineNo && "w-screen bg-secondary",
                )}
              >
                <Link
                  href={href}
                  className={cn(
                    "border-sr relative left-0 mr-4 inline-flex select-none items-center justify-end space-x-2 py-px pr-2 text-right text-muted-foreground",
                    i === 0 && "pt-2",
                    numberSectionWidth,
                  )}
                >
                  <LineActions
                    lineNo={i + 1}
                    setNewDiscussionLine={setNewDiscussionLine}
                  />
                  <span>{i + 1}</span>
                </Link>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
                {i + 1 === newDiscussionLine && (
                  <NewDiscussion
                    lineNo={i + 1}
                    setNewDiscussionLine={setNewDiscussionLine}
                    versionId={versionId}
                    targetId={targetId}
                    refetch={() => refetch()}
                  />
                )}
                {lineDiscussions.length > 0 && !hideDiscussions && (
                  <div className="flex h-auto w-screen flex-1 flex-col items-start justify-start gap-y-4 border-y bg-background px-2 py-2 font-sans">
                    {lineDiscussions.map((ld) => (
                      <div
                        key={ld.id}
                        className={cn(
                          "flex h-auto w-full max-w-3xl flex-col rounded-md border pb-2 pt-4",
                          {
                            "border-primary": discussionId === ld.id,
                            "pt-2": ld.isResolved,
                          },
                        )}
                      >
                        {!ld.isResolved && (
                          <>
                            <CommentCard
                              isOpeningComment
                              discussionId={ld.id}
                              comment={ld.openingComment!}
                              author={membersData?.members.find(
                                (m) =>
                                  m.userID === ld.openingComment?.createdBy,
                              )}
                              onUpdate={() => refetch()}
                              onDelete={() => {
                                refetch();
                                if (ld.id === discussionId) {
                                  applyParams({
                                    discussionId: null,
                                  });
                                }
                              }}
                            />
                            <Separator className="mb-2 mt-4" />
                          </>
                        )}
                        <div className="flex flex-wrap items-center gap-4 px-4">
                          {ld.isResolved && (
                            <p className="italic">
                              This discussion was marked as resolved
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="ml-auto w-max"
                            onClick={() => {
                              if (discussionId === ld.id) {
                                applyParams({
                                  discussionId: null,
                                });
                              } else {
                                applyParams({
                                  discussionId: ld.id,
                                });
                              }
                            }}
                          >
                            {discussionId === ld.id ? (
                              <>Hide thread</>
                            ) : (
                              <>
                                View thread <ArrowRightIcon className="ml-2" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
};