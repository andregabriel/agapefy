"use client";

import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Category } from '@/types/category';
import CategoryCard from './CategoryCard';

interface DraggableCategoryListProps {
  categories: Category[];
  onDragEnd: (result: DropResult) => void;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onToggleFeatured: (category: Category) => void;
  onClick: (category: Category) => void;
}

export default function DraggableCategoryList({
  categories,
  onDragEnd,
  onEdit,
  onDelete,
  onToggleFeatured,
  onClick
}: DraggableCategoryListProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable 
        droppableId="categories" 
        isDropDisabled={false}
        isCombineEnabled={false}
        ignoreContainerClipping={false}
      >
        {(provided, snapshot) => (
          <div 
            {...provided.droppableProps} 
            ref={provided.innerRef}
            className={`
              grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 relative
              ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}
            `}
            style={{
              minHeight: '200px'
            }}
          >
            {categories.map((category, index) => (
              <Draggable 
                key={category.id} 
                draggableId={category.id} 
                index={index} 
                isDragDisabled={false}
              >
                {(provided, snapshot) => (
                  <CategoryCard
                    category={category}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleFeatured={onToggleFeatured}
                    onClick={onClick}
                    isDragging={snapshot.isDragging}
                    dragHandleProps={provided.dragHandleProps}
                    draggableProps={provided.draggableProps}
                    innerRef={provided.innerRef}
                  />
                )}
              </Draggable>
            ))}
            
            {/* Placeholder customizado e invisível */}
            <div 
              style={{
                position: 'absolute',
                top: '-9999px',
                left: '-9999px',
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none'
              }}
            >
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}