/* TanzimFC editorial editor — Lexical. */
export async function createLexicalArticleEditor(editorEl, initialHTML = '', initialJSON = null, onChange = () => {}) {
  const [
    lexical,
    richText,
    history,
    link,
    extension,
    list,
    table,
    code,
    html,
    selection
  ] = await Promise.all([
    import('https://esm.sh/lexical@0.50.0'),
    import('https://esm.sh/@lexical/rich-text@0.50.0'),
    import('https://esm.sh/@lexical/history@0.50.0'),
    import('https://esm.sh/@lexical/link@0.50.0'),
    import('https://esm.sh/@lexical/extension@0.50.0'),
    import('https://esm.sh/@lexical/list@0.50.0'),
    import('https://esm.sh/@lexical/table@0.50.0'),
    import('https://esm.sh/@lexical/code@0.50.0'),
    import('https://esm.sh/@lexical/html@0.50.0'),
    import('https://esm.sh/@lexical/selection@0.50.0')
  ]);

  const {
    createEditor, $getRoot, $getSelection, $isRangeSelection, $isElementNode,
    $createParagraphNode, $createHeadingNode, $createQuoteNode, $createCodeNode,
    $createHorizontalRuleNode, FORMAT_TEXT_COMMAND,
    CAN_UNDO_COMMAND, CAN_REDO_COMMAND, UNDO_COMMAND, REDO_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND,
    OUTDENT_CONTENT_COMMAND, INDENT_CONTENT_COMMAND
  } = lexical;

  const {registerRichText} = richText;
  const {registerList, ListNode, ListItemNode} = list;
  const {createEmptyHistoryState, registerHistory} = history;
  const {LinkNode, TOGGLE_LINK_COMMAND, $isLinkNode, registerLink} = link;
  const {namedSignals} = extension;
  const {
    TableNode, TableRowNode, TableCellNode,
    $createTableNodeWithDimensions, $isTableNode, $isTableCellNode,
    $getTableCellNodeFromLexicalNode, $getTableNodeFromLexicalNodeOrThrow,
    $insertTableRowAtSelection, $insertTableColumnAtSelection,
    registerTablePlugin, registerTableSelectionObserver
  } = table;
  const {CodeNode} = code;
  const {$generateHtmlFromNodes, $generateNodesFromDOM} = html;
  const {$patchStyleText} = selection;

  class ImageNode extends lexical.DecoratorNode {
    static getType(){ return 'tanzim-image'; }
    static clone(node){ return new ImageNode(node.__src,node.__alt,node.__caption,node.__key); }
    constructor(src,alt='',caption='',key){ super(key); this.__src=src; this.__alt=alt; this.__caption=caption; }
    createDOM(){ const figure=document.createElement('figure'); figure.className='lexical-article-image'; return figure; }
    updateDOM(){ return false; }
    decorate(){
      const wrap=document.createElement('div');
      wrap.className='lexical-image-wrap';
      const img=document.createElement('img');
      img.src=this.__src; img.alt=this.__alt||'';
      img.loading='lazy'; img.decoding='async'; img.draggable=false;
      img.className='lexical-image-preview';
      wrap.appendChild(img);
      if(this.__caption){
        const cap=document.createElement('figcaption');
        cap.textContent=this.__caption;
        wrap.appendChild(cap);
      }
      return wrap;
    }
    exportJSON(){
      return {...super.exportJSON(),type:'tanzim-image',version:1,src:this.__src,alt:this.__alt,caption:this.__caption};
    }
    static importJSON(serialized){
      return new ImageNode(serialized.src,serialized.alt||'',serialized.caption||'');
    }
    exportDOM(){
      const figure=document.createElement('figure');
      const img=document.createElement('img');
      img.src=this.__src; img.alt=this.__alt||'';
      img.loading='lazy';
      figure.appendChild(img);
      if(this.__caption){
        const c=document.createElement('figcaption');
        c.textContent=this.__caption;
        figure.appendChild(c);
      }
      return {element:figure};
    }
    static importDOM(){
      return {
        img:()=>({
          conversion:(el)=>({
            node:new ImageNode(el.getAttribute('src')||'',el.getAttribute('alt')||'', '')
          }),
          priority:1
        })
      };
    }
  }

  const editor = createEditor({
    namespace:'TanzimFCArticleEditor',
    theme:{
      paragraph:'editor-paragraph',
      heading:{h1:'editor-h1',h2:'editor-h2',h3:'editor-h3'},
      quote:'editor-quote',
      list:{ul:'editor-list-ul',ol:'editor-list-ol',listitem:'editor-list-item'},
      text:{
        bold:'editor-bold',
        italic:'editor-italic',
        underline:'editor-underline',
        strikethrough:'editor-strike',
        code:'editor-inline-code'
      },
      link:'editor-link'
    },
    nodes:[
      LinkNode,ListNode,ListItemNode,
      TableNode,TableRowNode,TableCellNode,
      CodeNode,ImageNode
    ],
    onError(error){ console.error('[TanzimFC Lexical]',error); }
  });

  editor.setRootElement(editorEl);

  const cleanup = [];
  cleanup.push(registerRichText(editor));
  if(registerList) cleanup.push(registerList(editor));
  cleanup.push(registerLink(editor,namedSignals({
    attributes:{},
    validateUrl:(url)=>/^https?:/i.test(url)
  })));
  cleanup.push(registerTablePlugin(editor));
  cleanup.push(registerTableSelectionObserver(editor,true));

  const historyState=createEmptyHistoryState();
  cleanup.push(registerHistory(editor,historyState,300));

  let initialized=false;
  cleanup.push(editor.registerUpdateListener(({editorState,dirtyElements,dirtyLeaves})=>{
    if(initialized && (dirtyElements.size || dirtyLeaves.size)) onChange(editorState);
  }));

  editorEl.setAttribute('spellcheck','true');
  editorEl.setAttribute('contenteditable','true');
  editorEl.setAttribute('role','textbox');
  editorEl.setAttribute('aria-multiline','true');

  const loadInitialState = () => {
    if(initialJSON && typeof initialJSON === 'object' && initialJSON.root){
      try{
        editor.setEditorState(editor.parseEditorState(JSON.stringify(initialJSON)),{tag:'initial-load'});
        return;
      }catch(error){
        console.warn('[TanzimFC Lexical] Could not restore JSON state; falling back to HTML.',error);
      }
    }

    editor.update(()=>{
      const root=$getRoot();
      root.clear();
      const parser=new DOMParser();
      const dom=parser.parseFromString(String(initialHTML||'<p></p>'),'text/html');
      const nodes=$generateNodesFromDOM(editor,dom);
      root.append(...nodes);
      if(!root.getFirstChild()) root.append($createParagraphNode());
    },{tag:'initial-load'});
  };

  loadInitialState();
  initialized=true;

  const run=(fn)=>{
    editor.update(fn);
    return api;
  };

  const getTableCellFromSelection = (selectionArg) => {
    const s=selectionArg ?? $getSelection();
    if(!s) return null;
    if(s.anchor?.getNode){
      const direct=s.anchor.getNode();
      const cell=$getTableCellNodeFromLexicalNode(direct);
      if(cell) return cell;
    }
    if($isRangeSelection(s)){
      for(const node of s.getNodes?.()||[]){
        const cell=$getTableCellNodeFromLexicalNode(node);
        if(cell) return cell;
      }
    }
    if(s.getNodes){
      for(const node of s.getNodes()||[]){
        const cell=$getTableCellNodeFromLexicalNode(node);
        if(cell) return cell;
      }
    }
    return null;
  };

  const hasTableContext = () => {
    let found=false;
    editor.getEditorState().read(()=>{
      found=Boolean(getTableCellFromSelection($getSelection()));
    });
    return found;
  };

  const api={
    editor,

    getHTML(){
      let htmlOut='';
      editor.getEditorState().read(()=>{
        htmlOut=$generateHtmlFromNodes(editor,null);
      });
      return htmlOut;
    },

    getJSON(){
      return editor.getEditorState().toJSON();
    },

    focus(){
      editor.focus();
      return api;
    },

    destroy(){
      for(const fn of cleanup.splice(0)){
        try{fn?.();}catch{}
      }
      editor.setRootElement(null);
    },

    canUndo(){
      let value=false;
      editor.getEditorState().read(()=>{
        value=editor.getHistoryState?.()?.canUndo ?? false;
      });
      return value;
    },

    canRedo(){
      let value=false;
      editor.getEditorState().read(()=>{
        value=editor.getHistoryState?.()?.canRedo ?? false;
      });
      return value;
    },

    chain(){
      const commands=[];
      let result=true;

      const push=(fn)=>{
        commands.push(()=>{
          const out=fn();
          if(out===false) result=false;
        });
      };

      return {
        focus(){ push(()=>{editor.focus();return true;}); return this; },
        undo(){ push(()=>editor.dispatchCommand(UNDO_COMMAND,undefined)); return this; },
        redo(){ push(()=>editor.dispatchCommand(REDO_COMMAND,undefined)); return this; },

        toggleBold(){ push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'bold')); return this; },
        toggleItalic(){ push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'italic')); return this; },
        toggleUnderline(){ push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'underline')); return this; },
        toggleStrike(){ push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'strikethrough')); return this; },

        clearFormatting(){
          push(()=>{
            editor.update(()=>{
              const s=$getSelection();
              if(!$isRangeSelection(s)) return;
              editor.dispatchCommand(FORMAT_TEXT_COMMAND,'');
              $patchStyleText(s,{
                color:null,
                'background-color':null,
                'font-size':null,
                'font-family':null
              });
            });
            return true;
          });
          return this;
        },

        toggleBulletList(){
          push(()=>editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND,undefined));
          return this;
        },

        toggleOrderedList(){
          push(()=>editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND,undefined));
          return this;
        },

        outdent(){
          push(()=>editor.dispatchCommand(OUTDENT_CONTENT_COMMAND,undefined));
          return this;
        },

        indent(){
          push(()=>editor.dispatchCommand(INDENT_CONTENT_COMMAND,undefined));
          return this;
        },

        toggleHeading({level=2}={}){
          push(()=>{
            let changed=false;
            run(()=>{
              const s=$getSelection();
              if(!$isRangeSelection(s)) return;
              const blocks=new Set(
                s.getNodes()
                  .map(n=>n.getTopLevelElementOrThrow?.())
                  .filter(Boolean)
              );
              blocks.forEach(block=>{
                if(!block?.replace) return;
                if(block.getType?.()==='heading' && block.getTag?.()==='h'+level){
                  const paragraph=$createParagraphNode();
                  paragraph.append(...block.getChildren());
                  block.replace(paragraph);
                  changed=true;
                  return;
                }
                const heading=$createHeadingNode('h'+Math.min(3,Math.max(1,Number(level)||2)));
                heading.append(...block.getChildren());
                block.replace(heading);
                changed=true;
              });
            });
            return changed;
          });
          return this;
        },

        toggleBlockquote(){
          push(()=>{
            let changed=false;
            run(()=>{
              const s=$getSelection();
              if(!$isRangeSelection(s)) return;
              const top=s.anchor.getNode()?.getTopLevelElementOrThrow?.();
              if(!top?.replace) return;
              const quote=$createQuoteNode();
              quote.append(...top.getChildren());
              top.replace(quote);
              changed=true;
            });
            return changed;
          });
          return this;
        },

        setHorizontalRule(){
          push(()=>{
            let changed=false;
            run(()=>{
              const s=$getSelection();
              if($isRangeSelection(s)){
                s.insertNodes([$createHorizontalRuleNode()]);
                changed=true;
              }
            });
            return changed;
          });
          return this;
        },

        toggleCodeBlock(){
          push(()=>{
            let changed=false;
            run(()=>{
              const s=$getSelection();
              if(!$isRangeSelection(s)) return;
              const top=s.anchor.getNode()?.getTopLevelElementOrThrow?.();
              if(!top?.replace) return;
              const codeBlock=$createCodeNode();
              codeBlock.append(...top.getChildren());
              top.replace(codeBlock);
              changed=true;
            });
            return changed;
          });
          return this;
        },

        setTextAlign(value){
          push(()=>{
            let changed=false;
            run(()=>{
              const s=$getSelection();
              if(!$isRangeSelection(s)) return;
              const blocks=new Set(
                s.getNodes()
                  .map(n=>n.getTopLevelElementOrThrow?.())
                  .filter(Boolean)
              );
              blocks.forEach(block=>{
                if(block?.setFormat){
                  block.setFormat(value);
                  changed=true;
                }
              });
            });
            return changed;
          });
          return this;
        },

        setLink(payload){
          push(()=>{
            const url=typeof payload==='string'
              ? payload
              : String(payload?.url ?? payload?.href ?? '').trim();
            if(!url) return false;
            return editor.dispatchCommand(TOGGLE_LINK_COMMAND,{
              url,
              target:payload?.target,
              rel:payload?.rel,
              title:payload?.title
            });
          });
          return this;
        },

        unsetLink(){
          push(()=>editor.dispatchCommand(TOGGLE_LINK_COMMAND,null));
          return this;
        },

        patchStyle(styles){
          push(()=>{
            let changed=false;
            run(()=>{
              const s=$getSelection();
              if($isRangeSelection(s)){
                $patchStyleText(s,styles);
                changed=true;
              }
            });
            return changed;
          });
          return this;
        },

        setColor(color){
          return this.patchStyle({color:String(color||'')||null});
        },

        toggleHighlight(payload){
          return this.patchStyle({'background-color':String(payload?.color||'')||null});
        },

        setFontSize(value){
          return this.patchStyle({'font-size':String(value||'')||null});
        },

        setFontFamily(value){
          return this.patchStyle({'font-family':String(value||'')||null});
        },

        setImage(payload){
          push(()=>{
            let changed=false;
            run(()=>{
              const s=$getSelection();
              const n=new ImageNode(payload?.src||'',payload?.alt||'',payload?.caption||'');
              if($isRangeSelection(s)){
                s.insertNodes([n]);
                changed=true;
              }else{
                $getRoot().append(n);
                changed=true;
              }
            });
            return changed;
          });
          return this;
        },

        insertTable(payload={rows:3,cols:3,withHeaderRow:true}){
          push(()=>{
            let changed=false;
            run(()=>{
              const rows=Math.max(1,Math.min(20,Number(payload.rows)||3));
              const cols=Math.max(1,Math.min(12,Number(payload.cols)||3));
              const t=$createTableNodeWithDimensions(rows,cols,Boolean(payload.withHeaderRow));
              const s=$getSelection();
              if($isRangeSelection(s)){
                s.insertNodes([t]);
                changed=true;
              }else{
                $getRoot().append(t);
                changed=true;
              }
            });
            return changed;
          });
          return this;
        },

        addRowAfter(){
          push(()=>{
            if(!hasTableContext()) return false;
            let changed=false;
            run(()=>{
              $insertTableRowAtSelection(true);
              changed=true;
            });
            return changed;
          });
          return this;
        },

        addColumnAfter(){
          push(()=>{
            if(!hasTableContext()) return false;
            let changed=false;
            run(()=>{
              $insertTableColumnAtSelection(true);
              changed=true;
            });
            return this;
          });
          return this;
        },

        deleteTable(){
          push(()=>{
            const cell=editor.getEditorState().read(()=>{
              return getTableCellFromSelection($getSelection());
            });
            if(!cell) return false;
            let changed=false;
            run(()=>{
              const tableNode=$getTableNodeFromLexicalNodeOrThrow(cell);
              tableNode.remove();
              changed=true;
            });
            return changed;
          });
          return this;
        },

        run(){
          commands.forEach(fn=>fn());
          return result;
        }
      };
    },

    can(){
      return {
        addRowAfter:hasTableContext,
        addColumnAfter:hasTableContext,
        deleteTable:hasTableContext
      };
    }
  };

  return api;
}
