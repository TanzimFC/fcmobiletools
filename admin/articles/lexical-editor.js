/* TanzimFC editorial editor — Lexical, no TipTap dependency. */
export async function createLexicalArticleEditor(editorEl, initialHTML = '', onChange = () => {}) {
  const [
    lexical,
    richText,
    history,
    link,
    list,
    table,
    code,
    html
  ] = await Promise.all([
    import('https://esm.sh/lexical@0.38.2'),
    import('https://esm.sh/@lexical/rich-text@0.38.2'),
    import('https://esm.sh/@lexical/history@0.38.2'),
    import('https://esm.sh/@lexical/link@0.38.2'),
    import('https://esm.sh/@lexical/list@0.38.2'),
    import('https://esm.sh/@lexical/table@0.38.2'),
    import('https://esm.sh/@lexical/code@0.38.2'),
    import('https://esm.sh/@lexical/html@0.38.2')
  ]);

  const {
    createEditor, $getRoot, $getSelection, $isRangeSelection,
    $createParagraphNode, $createTextNode, $createHeadingNode,
    $createQuoteNode, $createCodeNode, $createHorizontalRuleNode,
    $isElementNode, $isTextNode, FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_EDITOR,
    CAN_UNDO_COMMAND, CAN_REDO_COMMAND,
    UNDO_COMMAND, REDO_COMMAND, INSERT_UNORDERED_LIST_COMMAND,
    INSERT_ORDERED_LIST_COMMAND, OUTDENT_CONTENT_COMMAND,
    INDENT_CONTENT_COMMAND
  } = lexical;

  const {registerRichText} = richText;
  const {createEmptyHistoryState, registerHistory} = history;
  const {LinkNode, TOGGLE_LINK_COMMAND, $isLinkNode} = link;
  const {
    ListNode, ListItemNode, $isListNode
  } = list;
  const {
    TableNode, TableRowNode, TableCellNode,
    $createTableNodeWithDimensions, $isTableNode, $isTableCellNode
  } = table;
  const {CodeNode} = code;
  const {$generateHtmlFromNodes, $generateNodesFromDOM} = html;

  class ImageNode extends lexical.DecoratorNode {
    static getType(){ return 'tanzim-image'; }
    static clone(node){ return new ImageNode(node.__src,node.__alt,node.__caption,node.__key); }
    constructor(src,alt='',caption='',key){ super(key); this.__src=src; this.__alt=alt; this.__caption=caption; }
    createDOM(){ const figure=document.createElement('figure'); figure.className='lexical-article-image'; return figure; }
    updateDOM(){ return false; }
    decorate(){
      const wrap=document.createElement('div');
      const img=document.createElement('img');
      img.src=this.__src; img.alt=this.__alt||'';
      img.loading='lazy'; img.decoding='async'; img.draggable=false;
      img.className='lexical-image-preview';
      wrap.appendChild(img);
      if(this.__caption){ const cap=document.createElement('figcaption'); cap.textContent=this.__caption; wrap.appendChild(cap); }
      return wrap;
    }
    exportJSON(){ return {...super.exportJSON(),type:'tanzim-image',version:1,src:this.__src,alt:this.__alt,caption:this.__caption}; }
    static importJSON(serialized){ return new ImageNode(serialized.src,serialized.alt||'',serialized.caption||''); }
    exportDOM(){ const figure=document.createElement('figure'); const img=document.createElement('img'); img.src=this.__src; img.alt=this.__alt||''; img.loading='lazy'; figure.appendChild(img); if(this.__caption){const c=document.createElement('figcaption');c.textContent=this.__caption;figure.appendChild(c);} return {element:figure}; }
    static importDOM(){ return {img:()=>({conversion:(el)=>({node:new ImageNode(el.getAttribute('src')||'',el.getAttribute('alt')||'', '')}),priority:1})}; }
  }

  const editor = createEditor({
    namespace:'TanzimFCArticleEditor',
    theme:{
      paragraph:'editor-paragraph',
      heading:{h1:'editor-h1',h2:'editor-h2',h3:'editor-h3'},
      quote:'editor-quote',
      list:{ul:'editor-list-ul',ol:'editor-list-ol',listitem:'editor-list-item'},
      text:{bold:'editor-bold',italic:'editor-italic',underline:'editor-underline',strikethrough:'editor-strike',code:'editor-inline-code'}
    },
    nodes:[LinkNode,ListNode,ListItemNode,TableNode,TableRowNode,TableCellNode,CodeNode,ImageNode],
    onError(error){ console.error('[TanzimFC Lexical]',error); }
  });

  editor.setRootElement(editorEl);
  registerRichText(editor);
  const historyState=createEmptyHistoryState();
  const unregisterHistory=registerHistory(editor,historyState,300);
  const unregisterUpdate=editor.registerUpdateListener(({editorState,dirtyElements,dirtyLeaves})=>{
    if(dirtyElements.size || dirtyLeaves.size) onChange();
  });

  editorEl.setAttribute('spellcheck','true');
  editorEl.setAttribute('contenteditable','true');
  editorEl.setAttribute('role','textbox');
  editorEl.setAttribute('aria-multiline','true');

  editor.update(()=>{
    const root=$getRoot();
    root.clear();
    const parser=new DOMParser();
    const dom=parser.parseFromString(initialHTML||'<p></p>','text/html');
    const nodes=$generateNodesFromDOM(editor,dom);
    root.append(...nodes);
    if(!root.getFirstChild()) root.append($createParagraphNode());
  },{tag:'initial-load'});

  const run=(fn)=>{ editor.update(fn); return api; };
  const api={
    editor,
    getHTML(){
      let htmlOut='';
      editor.getEditorState().read(()=>{htmlOut=$generateHtmlFromNodes(editor,null);});
      return htmlOut;
    },
    getJSON(){ return editor.getEditorState().toJSON(); },
    focus(){editor.focus();return api;},
    destroy(){unregisterUpdate();unregisterHistory();editor.setRootElement(null);},
    chain(){ const commands=[]; return {
      focus(){commands.push(()=>editor.focus());return this;},
      undo(){commands.push(()=>editor.dispatchCommand(UNDO_COMMAND,undefined));return this;},
      redo(){commands.push(()=>editor.dispatchCommand(REDO_COMMAND,undefined));return this;},
      toggleBold(){commands.push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'bold'));return this;},
      toggleItalic(){commands.push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'italic'));return this;},
      toggleUnderline(){commands.push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'underline'));return this;},
      toggleStrike(){commands.push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'strikethrough'));return this;},
      clear(){commands.push(()=>editor.dispatchCommand(FORMAT_TEXT_COMMAND,'');return this;},
      toggleBulletList(){commands.push(()=>editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND,undefined));return this;},
      toggleOrderedList(){commands.push(()=>editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND,undefined));return this;},
      setTextAlign(value){commands.push(()=>run(()=>{const s=$getSelection();if($isRangeSelection(s)){const nodes=s.getNodes();nodes.forEach(n=>{const el=n.getParent?.();if(el?.setFormat)el.setFormat(value);});}}));return this;},
      setLink(payload){commands.push(()=>editor.dispatchCommand(TOGGLE_LINK_COMMAND,payload?.href||null));return this;},
      unsetLink(){commands.push(()=>editor.dispatchCommand(TOGGLE_LINK_COMMAND,null));return this;},
      setColor(color){commands.push(()=>run(()=>{const s=$getSelection();if($isRangeSelection(s))s.setStyle('color:'+color+';');}));return this;},
      toggleHighlight(payload){commands.push(()=>run(()=>{const s=$getSelection();if($isRangeSelection(s))s.setStyle('background-color:'+payload.color+';');}));return this;},
      setMark(type,attrs){commands.push(()=>run(()=>{const s=$getSelection();if($isRangeSelection(s)){const style=[];if(attrs?.fontSize)style.push('font-size:'+attrs.fontSize);if(attrs?.fontFamily)style.push('font-family:'+attrs.fontFamily);s.setStyle(style.join(';'));}}));return this;},
      setImage(payload){commands.push(()=>run(()=>{const s=$getSelection();const n=new ImageNode(payload.src,payload.alt||'',payload.caption||'');if($isRangeSelection(s)){s.insertNodes([n]);}else{$getRoot().append(n);}}));return this;},
      insertTable(payload={rows:3,cols:3,withHeaderRow:true}){commands.push(()=>run(()=>{const t=$createTableNodeWithDimensions(payload.rows||3,payload.cols||3,!!payload.withHeaderRow);const s=$getSelection();if($isRangeSelection(s))s.insertNodes([t]);else $getRoot().append(t);}));return this;},
      addRowAfter(){commands.push(()=>run(()=>{const s=$getSelection();const cell=s?.getNodes?.().find($isTableCellNode);const row=cell?.getParent();if(row instanceof TableRowNode){const tableNode=row.getParent();const idx=tableNode.getChildren().indexOf(row);const clone=row.clone();clone.getChildren().forEach(c=>c.clear());tableNode.splice(idx+1,0,[clone]);}}));return this;},
      addColumnAfter(){commands.push(()=>run(()=>{const s=$getSelection();const cell=s?.getNodes?.().find($isTableCellNode);const row=cell?.getParent();const tableNode=row?.getParent();if(row&&tableNode instanceof TableNode){const col=cell.getIndexWithinParent();tableNode.getChildren().forEach(r=>{const newCell=new TableCellNode();r.splice(col+1,0,[newCell]);});}}));return this;},
      deleteTable(){commands.push(()=>run(()=>{const s=$getSelection();const cell=s?.getNodes?.().find($isTableCellNode);const tableNode=cell?.getParent()?.getParent();if(tableNode instanceof TableNode)tableNode.remove();}));return this;},
      run(){commands.forEach(fn=>fn());return true;}
    };},
    can(){return {addRowAfter(){return true},addColumnAfter(){return true},deleteTable(){return true}}}
  };
  return api;
}
